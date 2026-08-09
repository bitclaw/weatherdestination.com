import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { config } from '@/config';
import { sanitizeRedirectPath } from '@/lib/constants/paths';
import { getSeoMeta } from '@/lib/seo';
import { SignupPage } from '@/pages/signup';

const searchSchema = z.object({
  redirect: z.string().optional().transform(sanitizeRedirectPath)
});

export const Route = createFileRoute('/_auth/signup')({
  validateSearch: searchSchema,
  head: () => ({
    meta: getSeoMeta({
      title: `Sign Up - ${config.appName}`,
      description: `Create your ${config.appName} account.`,
      url: `https://${config.domainName}/signup`,
      // Functional auth form, no unique indexable content - keep it out of
      // search results instead of padding it with copy to clear a
      // word-count check. See getSeoMeta's `noindex` doc comment.
      noindex: true
    })
  }),
  component: SignupPage
});
