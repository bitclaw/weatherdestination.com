import { createFileRoute } from '@tanstack/react-router';
import { FeatureCreatePage } from '@/features/FEATURE';

export const Route = createFileRoute('/_app/FEATURE/new')({
  component: FeatureCreatePage
});
