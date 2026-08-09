import { describe, expect, it } from 'bun:test';
import { HttpResponse, http } from 'msw';
import type { AppJobs } from '@/features/jobs/types';
import { mswServer } from '@/test/msw/server';
import { handleReengagement } from './email-reengagement';
import { makeJob as makeJobBase } from './jobs-test-fixtures';

const makeJob = (data?: Partial<AppJobs['email:reengagement']>) =>
  makeJobBase('email:reengagement', {
    userId: 'user_1',
    email: 'test@example.com',
    name: 'Test User',
    ...data
  });

describe('handleReengagement', () => {
  it('resolves when email provider accepts the request', async () => {
    await expect(handleReengagement(makeJob())).resolves.toBeUndefined();
  });

  it('resolves with null name', async () => {
    await expect(
      handleReengagement(makeJob({ name: null }))
    ).resolves.toBeUndefined();
  });

  it('throws when email provider returns an error', async () => {
    mswServer.use(
      http.post('https://api.resend.com/emails', () =>
        HttpResponse.json(
          { name: 'validation_error', message: 'The from address is invalid.' },
          { status: 422 }
        )
      )
    );

    await expect(handleReengagement(makeJob())).rejects.toThrow();
  });
});
