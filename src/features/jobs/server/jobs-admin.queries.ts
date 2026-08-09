import type { JobStatus } from '@bitclaw/jobs';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { requireAdmin } from '@/server/require-admin';
import { getJobQueue } from '../queue.server';
import { getScheduler } from '../scheduler.server';
import {
  getJobStatsLogic,
  getJobTypesLogic,
  getSchedulesLogic,
  listFailedJobsLogic,
  listJobsLogic
} from './jobs-admin-logic';

export const getJobStats = createServerFn({ method: 'GET' }).handler(
  async () => {
    const admin = await requireAdmin();
    if (!admin.ok) return admin;
    return getJobStatsLogic(getJobQueue());
  }
);

export const listAdminJobs = createServerFn({ method: 'GET' })
  .validator(
    z.object({
      status: z
        .enum(['active', 'done', 'failed', 'waiting', 'running'])
        .optional(),
      type: z.string().optional(),
      limit: z.number().int().min(1).max(100).default(10),
      offset: z.number().int().min(0).default(0)
    })
  )
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    if (!admin.ok) return admin;
    return listJobsLogic(getJobQueue(), {
      ...data,
      status: data.status as JobStatus | undefined
    });
  });

export const getJobTypes = createServerFn({ method: 'GET' }).handler(
  async () => {
    const admin = await requireAdmin();
    if (!admin.ok) return admin;
    return getJobTypesLogic(getJobQueue());
  }
);

export const listFailedAdminJobs = createServerFn({ method: 'GET' })
  .validator(
    z.object({
      type: z.string().optional(),
      limit: z.number().int().min(1).max(100).default(10),
      offset: z.number().int().min(0).default(0)
    })
  )
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    if (!admin.ok) return admin;
    return listFailedJobsLogic(getJobQueue(), data);
  });

export const getSchedulesList = createServerFn({ method: 'GET' }).handler(
  async () => {
    const admin = await requireAdmin();
    if (!admin.ok) return admin;
    return getSchedulesLogic(getScheduler());
  }
);
