import { describe, expect, it } from 'bun:test';
import { HttpResponse, http } from 'msw';
import type { AppJobs } from '@/features/jobs/types';
import { mswServer } from '@/test/msw/server';
import { handleTrialExpiring } from './email-trial-expiring';
import { makeJob as makeJobBase } from './jobs-test-fixtures';

const makeJob = (data?: Partial<AppJobs['email:trial-expiring']>) =>
  makeJobBase('email:trial-expiring', {
    userId: 'user_1',
    email: 'test@example.com',
    name: 'Test User',
    daysLeft: 3,
    ...data
  });

describe('handleTrialExpiring', () => {
  it('resolves when email provider accepts the request', async () => {
    await expect(handleTrialExpiring(makeJob())).resolves.toBeUndefined();
  });

  it('resolves with daysLeft = 1', async () => {
    await expect(
      handleTrialExpiring(makeJob({ daysLeft: 1 }))
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

    await expect(handleTrialExpiring(makeJob())).rejects.toThrow();
  });
});
