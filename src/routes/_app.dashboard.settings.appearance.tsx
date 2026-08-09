import { createFileRoute } from '@tanstack/react-router';
import { AppearancePage } from '@/pages/settings/appearance-page';

export const Route = createFileRoute('/_app/dashboard/settings/appearance')({
  component: AppearancePage
});
