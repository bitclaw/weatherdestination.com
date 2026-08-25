import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { config } from '@/config';
import { sanitizeRedirectPath } from '@/lib/constants/paths';
import { getSeoMeta } from '@/lib/seo';
import { TwoFactorPage } from '@/pages/two-factor';

const searchSchema = z.object({
  redirectTo: z.string().optional().transform(sanitizeRedirectPath)
});

export const Route = createFileRoute('/_auth/two-factor')({
  validateSearch: searchSchema,
  head: () => ({
    meta: getSeoMeta({
      title: `Two-Factor Authentication - ${config.appName}`,
      description: 'Enter your two-factor authentication code.',
      url: `https://${config.domainName}/two-factor`,
      noindex: true
    })
  }),
  component: TwoFactorPage
});
