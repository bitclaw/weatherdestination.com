import { describe, expect, it } from 'bun:test';
import { HttpResponse, http } from 'msw';
import type { AppJobs } from '@/features/jobs/types';
import { mswServer } from '@/test/msw/server';
import { handleOnboardingDay7 } from './email-onboarding-day7';
import { makeJob as makeJobBase } from './jobs-test-fixtures';

const makeJob = (data?: Partial<AppJobs['email:onboarding-day7']>) =>
  makeJobBase('email:onboarding-day7', {
    userId: 'user_1',
    email: 'test@example.com',
    name: 'Test User',
    ...data
  });

describe('handleOnboardingDay7', () => {
  it('resolves when email provider accepts the request', async () => {
    await expect(handleOnboardingDay7(makeJob())).resolves.toBeUndefined();
  });

  it('resolves with null name', async () => {
    await expect(
      handleOnboardingDay7(makeJob({ name: null }))
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

    await expect(handleOnboardingDay7(makeJob())).rejects.toThrow();
  });
});
