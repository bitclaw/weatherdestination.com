import { createFileRoute } from '@tanstack/react-router';
import { NoteCreatePage } from '@/features/notes/pages/detail';

export const Route = createFileRoute('/_app/dashboard/notes/new')({
  component: NoteCreatePage
});
