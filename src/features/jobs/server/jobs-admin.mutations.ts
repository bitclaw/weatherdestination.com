import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireAdmin } from '@/server/require-admin';
import { getJobQueue } from '../queue.server';
import { getScheduler } from '../scheduler.server';
import {
  cancelJobLogic,
  forceRetryJobLogic,
  pauseScheduleLogic,
  purgeFailedJobsLogic,
  purgeJobsLogic,
  resumeScheduleLogic,
  retryFailedJobLogic
} from './jobs-admin-logic';

// IP limiter intentionally omitted here , requireAdmin()'s session lookup is
// already the rate bottleneck for admin-only endpoints.
export const cancelAdminJob = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    if (!admin.ok) return admin;
    return cancelJobLogic(getJobQueue(), data.id);
  });

export const forceRetryAdminJob = createServerFn({ method: 'POST' })
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    if (!admin.ok) return admin;
    return forceRetryJobLogic(getJobQueue(), data.id);
  });

export const retryFailedAdminJob = createServerFn({ method: 'POST' })
  .validator(z.object({ failedJobId: z.number().int() }))
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    if (!admin.ok) return admin;
    return retryFailedJobLogic(getJobQueue(), data.failedJobId);
  });

export const purgeAdminJobs = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      status: z.enum(['done', 'failed']),
      olderThanDays: z.number().int().min(1).default(1)
    })
  )
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    if (!admin.ok) return admin;
    return purgeJobsLogic(getJobQueue(), {
      status: data.status,
      olderThanMs: data.olderThanDays * 24 * 60 * 60 * 1000
    });
  });

export const purgeFailedAdminJobs = createServerFn({ method: 'POST' })
  .validator(z.object({ olderThanDays: z.number().int().min(1).default(7) }))
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    if (!admin.ok) return admin;
    return purgeFailedJobsLogic(
      getJobQueue(),
      data.olderThanDays * 24 * 60 * 60 * 1000
    );
  });

export const pauseScheduleAdmin = createServerFn({ method: 'POST' })
  .validator(z.object({ name: z.string().min(1).max(100) }))
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    if (!admin.ok) return admin;
    return pauseScheduleLogic(getScheduler(), data.name);
  });

export const resumeScheduleAdmin = createServerFn({ method: 'POST' })
  .validator(z.object({ name: z.string().min(1).max(100) }))
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    if (!admin.ok) return admin;
    return resumeScheduleLogic(getScheduler(), data.name);
  });
