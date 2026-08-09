import { createFileRoute } from '@tanstack/react-router';
import { SettingsLayout } from '@/pages/settings';

export const Route = createFileRoute('/_app/dashboard/settings')({
  component: SettingsLayout
});
