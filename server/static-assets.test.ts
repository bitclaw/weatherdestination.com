import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildAssetResponse, loadAssetForPreload } from './static-assets';

let testDir: string;

beforeAll(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'static-assets-test-'));
});

afterAll(() => {
  fs.rmSync(testDir, { recursive: true, force: true });
});

const writeFile = async (name: string, content: string): Promise<string> => {
  const filepath = path.join(testDir, name);
  await Bun.write(filepath, content);
  return filepath;
};

const baseConfig = {
  maxPreloadBytes: 1024,
  enableEtag: true,
  enableGzip: true,
  gzipMinBytes: 10
};

describe('loadAssetForPreload', () => {
  it('returns null for a file over the size threshold', async () => {
    const filepath = await writeFile('big.txt', 'x'.repeat(2000));
    const asset = await loadAssetForPreload(filepath, 'text/plain', baseConfig);
    expect(asset).toBeNull();
  });

  it('returns null for a missing file', async () => {
    const asset = await loadAssetForPreload(
      path.join(testDir, 'does-not-exist.txt'),
      'text/plain',
      baseConfig
    );
    expect(asset).toBeNull();
  });

  it('returns an in-memory asset with an ETag for a small file', async () => {
    const filepath = await writeFile('small.txt', 'hello world');
    const asset = await loadAssetForPreload(filepath, 'text/plain', baseConfig);
    expect(asset).not.toBeNull();
    expect(asset?.etag).toMatch(/^W\/"/);
    expect(asset?.type).toBe('text/plain');
  });

  it('omits the ETag when disabled', async () => {
    const filepath = await writeFile('no-etag.txt', 'hello world');
    const asset = await loadAssetForPreload(filepath, 'text/plain', {
      ...baseConfig,
      enableEtag: false
    });
    expect(asset?.etag).toBeUndefined();
  });

  it('gzips a compressible file over the gzip size minimum', async () => {
    const filepath = await writeFile(
      'compressible.txt',
      'a'.repeat(500) // well over gzipMinBytes: 10
    );
    const asset = await loadAssetForPreload(filepath, 'text/plain', baseConfig);
    expect(asset?.gz).toBeDefined();
    expect(asset?.gz?.byteLength).toBeLessThan(asset?.raw.byteLength ?? 0);
  });

  it('does not gzip a non-compressible MIME type', async () => {
    const filepath = await writeFile('image.bin', 'a'.repeat(500));
    const asset = await loadAssetForPreload(filepath, 'image/png', baseConfig);
    expect(asset?.gz).toBeUndefined();
  });

  it('does not gzip a file under the gzip size minimum', async () => {
    const filepath = await writeFile('tiny.txt', 'hi');
    const asset = await loadAssetForPreload(filepath, 'text/plain', baseConfig);
    expect(asset?.gz).toBeUndefined();
  });
});

describe('buildAssetResponse', () => {
  it('serves an on-demand Bun.file response when asset is null', () => {
    const filepath = path.join(testDir, 'on-demand.txt');
    const response = buildAssetResponse(
      null,
      filepath,
      'text/plain',
      'public, max-age=3600',
      new Request('http://localhost/on-demand.txt')
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/plain');
    expect(response.headers.get('ETag')).toBeNull();
  });

  it('returns 304 when if-none-match matches the asset ETag', async () => {
    const filepath = await writeFile('etag-match.txt', 'content');
    const asset = await loadAssetForPreload(filepath, 'text/plain', baseConfig);
    const etag = asset?.etag ?? '';
    const response = buildAssetResponse(
      asset,
      filepath,
      'text/plain',
      'public, max-age=3600',
      new Request('http://localhost/etag-match.txt', {
        headers: { 'if-none-match': etag }
      })
    );
    expect(response.status).toBe(304);
    expect(response.headers.get('ETag')).toBe(etag);
  });

  it('returns 200 with the full body when if-none-match does not match', async () => {
    const filepath = await writeFile('etag-mismatch.txt', 'content');
    const asset = await loadAssetForPreload(filepath, 'text/plain', baseConfig);
    const response = buildAssetResponse(
      asset,
      filepath,
      'text/plain',
      'public, max-age=3600',
      new Request('http://localhost/etag-mismatch.txt', {
        headers: { 'if-none-match': 'W/"wrong"' }
      })
    );
    expect(response.status).toBe(200);
  });

  it('serves gzip with Vary when Accept-Encoding includes gzip', async () => {
    const filepath = await writeFile('gzip-me.txt', 'a'.repeat(500));
    const asset = await loadAssetForPreload(filepath, 'text/plain', baseConfig);
    const response = buildAssetResponse(
      asset,
      filepath,
      'text/plain',
      'public, max-age=3600',
      new Request('http://localhost/gzip-me.txt', {
        headers: { 'accept-encoding': 'gzip, deflate' }
      })
    );
    expect(response.headers.get('Content-Encoding')).toBe('gzip');
    expect(response.headers.get('Vary')).toBe('Accept-Encoding');
  });

  it('serves raw bytes with Vary set when Accept-Encoding excludes gzip', async () => {
    const filepath = await writeFile('no-gzip-req.txt', 'a'.repeat(500));
    const asset = await loadAssetForPreload(filepath, 'text/plain', baseConfig);
    const response = buildAssetResponse(
      asset,
      filepath,
      'text/plain',
      'public, max-age=3600',
      new Request('http://localhost/no-gzip-req.txt')
    );
    expect(response.headers.get('Content-Encoding')).toBeNull();
    expect(response.headers.get('Vary')).toBe('Accept-Encoding');
  });
});
