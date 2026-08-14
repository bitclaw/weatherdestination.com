import {
  useQuery,
  useQueryClient,
  useSuspenseQuery
} from '@tanstack/react-query';
import { FileText, Image, Trash2, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { Button } from '@/components/ui/button';
import { ErrorBanner } from '@/components/ui/error-banner';
import { config } from '@/config';
import { EntitlementGate, subscriptionQueryOptions } from '@/features/billing';
import type { FileRecord } from '@/features/uploads';
import {
  ALLOWED_MIME_TYPES,
  addUploadToDbFn,
  deleteUploadFn,
  getDownloadUrlFn,
  getUploadUrlFn,
  MAX_FILE_SIZE_BYTES,
  uploadsQueryOptions
} from '@/features/uploads';
import type { PlanKey } from '@/lib/entitlements';
import { checkEntitlement } from '@/lib/entitlements';
import { uploadsQueryKey } from '@/lib/query-keys';
import { relativeTime } from '@/lib/utils';

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getFileIcon = (type: string) => {
  if (type.startsWith('image/'))
    return <Image className="h-4 w-4 shrink-0 text-info" />;
  return <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />;
};

function SetupCard() {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <Upload className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
      <h3 className="mb-1 font-semibold">File uploads not configured</h3>
      <p className="mx-auto max-w-sm text-sm text-muted-foreground">
        Add these environment variables to enable S3-backed file uploads:
      </p>
      <pre className="mt-4 inline-block rounded-md bg-muted px-4 py-3 text-left text-xs">
        {`AWS_S3_IAM_ACCESS_KEY=...\nAWS_S3_IAM_SECRET_KEY=...\nAWS_S3_FILES_BUCKET=...\nAWS_S3_REGION=us-east-1\nVITE_S3_FILES_BUCKET=...  # same as bucket`}
      </pre>
    </div>
  );
}

export function UploadsPage() {
  const { data: files } = useSuspenseQuery(uploadsQueryOptions);
  const { data: sub } = useQuery(subscriptionQueryOptions);
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const plan = (sub?.plan ?? 'free') as PlanKey;
  const entitlement = checkEntitlement(plan, 'maxFileUploads', files.length);

  const handleUpload = async (file: File) => {
    setActionError(null);

    if (
      !ALLOWED_MIME_TYPES.includes(
        file.type as (typeof ALLOWED_MIME_TYPES)[number]
      )
    ) {
      setActionError(`File type not allowed: ${file.type}`);
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setActionError(
        `File too large. Maximum size is ${formatBytes(MAX_FILE_SIZE_BYTES)}.`
      );
      return;
    }

    const urlResult = await getUploadUrlFn({
      data: {
        name: file.name,
        type: file.type as (typeof ALLOWED_MIME_TYPES)[number],
        size: file.size
      }
    });
    if (!urlResult.ok) {
      setActionError(urlResult.message);
      return;
    }

    const { url, fields, s3Key } = urlResult.data;

    try {
      await new Promise<void>((resolve, reject) => {
        const formData = new FormData();
        for (const [k, v] of Object.entries(fields))
          formData.append(k, v as string);
        formData.append('file', file);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);
        xhr.upload.onprogress = e => {
          if (e.lengthComputable)
            setUploadProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`S3 upload failed: ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(formData);
      });
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Upload failed');
      setUploadProgress(null);
      return;
    }

    setUploadProgress(null);

    const addResult = await addUploadToDbFn({
      data: {
        s3Key,
        name: file.name,
        type: file.type as (typeof ALLOWED_MIME_TYPES)[number],
        size: file.size
      }
    });
    if (!addResult.ok) {
      setActionError(addResult.message);
      return;
    }

    await queryClient.invalidateQueries({ queryKey: uploadsQueryKey() });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (file: FileRecord) => {
    setActionError(null);
    const result = await deleteUploadFn({ data: { id: file.id } });
    if (!result.ok) {
      setActionError(result.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: uploadsQueryKey() });
  };

  const handleDownload = async (file: FileRecord) => {
    setActionError(null);
    const result = await getDownloadUrlFn({ data: { id: file.id } });
    if (!result.ok) {
      setActionError(result.message);
      return;
    }
    window.open(result.data.url, '_blank');
  };

  return (
    <>
      <Header fixed>
        <div className="flex-1" />
        <ThemeSwitcher />
      </Header>
      <Main>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Files</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Upload and manage your files.
              </p>
            </div>
            {config.uploads.enabled && (
              <EntitlementGate
                allowed={entitlement.allowed}
                limit={entitlement.limit}
                resource="files"
                used={entitlement.used}
              >
                <Button
                  disabled={uploadProgress !== null}
                  onClick={() => fileInputRef.current?.click()}
                  size="sm"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Upload file
                </Button>
              </EntitlementGate>
            )}
          </div>

          <ErrorBanner message={actionError} variant="error" />

          {!config.uploads.enabled ? (
            <SetupCard />
          ) : (
            <>
              <input
                accept={ALLOWED_MIME_TYPES.join(',')}
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(file);
                }}
                ref={fileInputRef}
                type="file"
              />

              {uploadProgress !== null && (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {files.length === 0 ? (
                <div className="rounded-md border py-12 text-center text-sm text-muted-foreground">
                  No files yet. Upload one to get started.
                </div>
              ) : (
                <div className="divide-y rounded-lg border">
                  {files.map(file => (
                    <div
                      className="flex items-center gap-3 px-4 py-3"
                      key={file.id}
                    >
                      {getFileIcon(file.type)}
                      <button
                        className="min-w-0 flex-1 text-left"
                        onClick={() => handleDownload(file)}
                        type="button"
                      >
                        <p className="truncate text-sm font-medium hover:underline">
                          {file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatBytes(file.size)} ·{' '}
                          {relativeTime(file.created_at)}
                        </p>
                      </button>
                      <Button
                        className="shrink-0"
                        onClick={() => handleDelete(file)}
                        size="icon"
                        title="Delete file"
                        variant="ghost"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </Main>
    </>
  );
}
