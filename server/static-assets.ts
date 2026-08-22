// Boot-time static-asset route building: globs dist/client once, optionally
// preloads small files into memory with ETag/gzip precomputed, and builds a
// Bun.serve() route-table entry per file. Large files (over
// ASSET_PRELOAD_MAX_SIZE) are served on-demand from disk instead. Adapted
// from TanStack's reference "Production Server with Bun" example
// (examples/react/start-bun/server.ts) - that reference has none of this
// app's auth-cookie bypass, security headers, or clean-URL prerendering,
// all of which stay in server/start.ts; this file is asset-serving only.
import fs from 'node:fs';
import path from 'node:path';

export type InMemoryAsset = {
  raw: Uint8Array;
  gz?: Uint8Array;
  etag?: string;
  type: string;
  size: number;
};

export type AssetPreloadConfig = {
  maxPreloadBytes: number;
  enableEtag: boolean;
  enableGzip: boolean;
  gzipMinBytes: number;
};

export const readAssetPreloadConfig = (): AssetPreloadConfig => ({
  maxPreloadBytes: Number(
    process.env.ASSET_PRELOAD_MAX_SIZE ?? 5 * 1024 * 1024
  ),
  enableEtag: (process.env.ASSET_PRELOAD_ENABLE_ETAG ?? 'true') === 'true',
  enableGzip: (process.env.ASSET_PRELOAD_ENABLE_GZIP ?? 'true') === 'true',
  gzipMinBytes: Number(process.env.ASSET_PRELOAD_GZIP_MIN_SIZE ?? 1024)
});

// MIME prefixes/exact matches eligible for gzip - text-ish content where
// compression reliably helps. Matches the TanStack reference's default set.
const GZIP_MIME_TYPES = [
  'text/',
  'application/javascript',
  'application/json',
  'application/xml',
  'image/svg+xml'
];

const isMimeCompressible = (mimeType: string): boolean =>
  GZIP_MIME_TYPES.some(type =>
    type.endsWith('/') ? mimeType.startsWith(type) : mimeType === type
  );

const computeEtag = (data: Uint8Array): string => {
  const hash = Bun.hash(data);
  return `W/"${hash.toString(16)}-${data.byteLength.toString()}"`;
};

// Returns null when the file is too large to preload - the caller serves it
// on-demand from disk instead. ETag/gzip are computed once here at boot, not
// per request. Bun.hash is deterministic across processes, so an ETag
// computed by one cluster.ts worker is still valid when a client's
// conditional request happens to land on a different worker.
export const loadAssetForPreload = async (
  filepath: string,
  mimeType: string,
  config: AssetPreloadConfig
): Promise<InMemoryAsset | null> => {
  const file = Bun.file(filepath);
  if (!(await file.exists())) return null;
  if (file.size === 0 || file.size > config.maxPreloadBytes) return null;

  const raw = new Uint8Array(await file.arrayBuffer());
  const gz =
    config.enableGzip &&
    raw.byteLength >= config.gzipMinBytes &&
    isMimeCompressible(mimeType)
      ? Bun.gzipSync(raw)
      : undefined;
  const etag = config.enableEtag ? computeEtag(raw) : undefined;

  return { raw, gz, etag, type: mimeType, size: raw.byteLength };
};

// Builds the Response for a preloaded (in-memory) or on-demand (disk-read)
// asset - ETag/304 and gzip negotiation for the former, a plain Bun.file
// stream for the latter. `Vary: Accept-Encoding` is set whenever a gzip
// variant exists, regardless of whether this particular request used it -
// without it, an intermediary cache could legally serve the wrong encoding
// to a client that didn't ask for it.
export const buildAssetResponse = (
  asset: InMemoryAsset | null,
  filepath: string,
  mimeType: string,
  cacheControl: string,
  request: Request
): Response => {
  if (!asset) {
    return new Response(Bun.file(filepath), {
      headers: { 'Content-Type': mimeType, 'Cache-Control': cacheControl }
    });
  }

  const headers = new Headers({
    'Content-Type': mimeType,
    'Cache-Control': cacheControl
  });
  if (asset.gz) headers.set('Vary', 'Accept-Encoding');

  if (asset.etag) {
    const ifNoneMatch = request.headers.get('if-none-match');
    if (ifNoneMatch === asset.etag) {
      const notModifiedHeaders = new Headers({ ETag: asset.etag });
      if (asset.gz) notModifiedHeaders.set('Vary', 'Accept-Encoding');
      return new Response(null, { status: 304, headers: notModifiedHeaders });
    }
    headers.set('ETag', asset.etag);
  }

  if (asset.gz && request.headers.get('accept-encoding')?.includes('gzip')) {
    headers.set('Content-Encoding', 'gzip');
    headers.set('Content-Length', String(asset.gz.byteLength));
    return new Response(new Uint8Array(asset.gz), { headers });
  }

  headers.set('Content-Length', String(asset.raw.byteLength));
  return new Response(new Uint8Array(asset.raw), { headers });
};

export type StaticAssetRoutes = Record<
  string,
  { GET: (req: Request) => Response }
>;

// Globs dist/client once at boot and builds one route per file - including
// literal on-disk paths like /pricing/index.html, which also exist
// separately from server/start.ts's PRERENDERED map's clean-URL entries
// (/pricing). Deliberately not deduped against PRERENDERED: today, a direct
// request for a literal *.html path bypasses the auth-cookie SSR-bypass
// check entirely (it was never in PRERENDERED to begin with), and this
// preserves that exactly rather than silently changing behavior as a side
// effect of this refactor. Also preserves the pre-existing quirk that
// `.html` has no MIME table entry - a literal `pricing/index.html` request
// gets `application/octet-stream`, not `text/html`, same as before.
export const buildStaticAssetRoutes = async (
  distClient: string,
  mimeTypes: Record<string, string>,
  cacheControlOverrides: Record<string, string>,
  config: AssetPreloadConfig
): Promise<StaticAssetRoutes> => {
  // Collect paths first, then load every asset concurrently - awaiting
  // loadAssetForPreload() one file at a time inside `for await` here would
  // serialize every disk read + gzip/hash computation, adding real seconds
  // to server startup (measured directly in warpkit.dev: this was slow
  // enough to make tests/boot-smoke.ts's readiness assumption - that
  // logging "started" is followed immediately by the port being open -
  // false).
  const glob = new Bun.Glob('**/*');
  const relativePaths: string[] = [];
  for await (const relativePath of glob.scan({ cwd: distClient })) {
    relativePaths.push(relativePath);
  }

  const entries = await Promise.all(
    relativePaths
      .filter(relativePath =>
        fs.statSync(path.join(distClient, relativePath)).isFile()
      )
      .map(async relativePath => {
        const filepath = path.join(distClient, relativePath);
        const urlPath = `/${relativePath.split(path.sep).join('/')}`;
        const ext = path.extname(filepath).toLowerCase();
        const mimeType = mimeTypes[ext] ?? 'application/octet-stream';
        const isHashed = urlPath.startsWith('/assets/');
        const cacheControl =
          cacheControlOverrides[urlPath] ??
          (isHashed
            ? 'public, max-age=31536000, immutable'
            : 'public, max-age=0, must-revalidate');

        const asset = await loadAssetForPreload(filepath, mimeType, config);
        return [
          urlPath,
          {
            GET: (request: Request) =>
              buildAssetResponse(
                asset,
                filepath,
                mimeType,
                cacheControl,
                request
              )
          }
        ] as const;
      })
  );

  return Object.fromEntries(entries);
};
