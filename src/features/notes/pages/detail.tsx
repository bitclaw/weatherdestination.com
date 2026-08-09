import { useForm } from '@tanstack/react-form';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { type ReactNode, useState } from 'react';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { ErrorBanner } from '@/components/ui/error-banner';
import { FormField } from '@/components/ui/form-field';
import {
  createNoteFn,
  noteDetailQueryOptions,
  updateNoteFn
} from '@/features/notes';
import { noteInputSchema } from '@/features/notes/notes.constants';
import { noteDetailQueryKey, notesQueryKey } from '@/lib/query-keys';

function EditForm({ id }: { id: string }) {
  const { data: note } = useSuspenseQuery(noteDetailQueryOptions(id));
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [actionError, setActionError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { title: note.title, content: note.content },
    onSubmit: async ({ value }) => {
      setActionError(null);
      const result = await updateNoteFn({
        data: { id, title: value.title.trim(), content: value.content.trim() }
      });
      if (!result.ok) {
        setActionError(result.message);
        return;
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: notesQueryKey() }),
        queryClient.invalidateQueries({ queryKey: noteDetailQueryKey(id) })
      ]);
      navigate({ to: '/dashboard/notes' });
    }
  });

  return (
    <FormShell
      actionError={actionError}
      onSubmit={() => form.handleSubmit()}
      title="Edit note"
    >
      <form.Field
        name="title"
        validators={{ onChange: noteInputSchema.shape.title }}
      >
        {field => (
          <FormField
            error={field.state.meta.errors[0]?.toString()}
            htmlFor="note-title"
            label="Title"
          >
            <input
              className="border-input bg-background ring-offset-background focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
              id="note-title"
              onBlur={field.handleBlur}
              onChange={e => field.handleChange(e.target.value)}
              placeholder="Note title"
              type="text"
              value={field.state.value}
            />
          </FormField>
        )}
      </form.Field>

      <form.Field name="content">
        {field => (
          <FormField htmlFor="note-content" label="Content" optional>
            <textarea
              className="border-input bg-background ring-offset-background focus:ring-ring min-h-48 w-full rounded-md border px-3 py-2 font-mono text-sm focus:ring-2 focus:outline-none"
              id="note-content"
              onBlur={field.handleBlur}
              onChange={e => field.handleChange(e.target.value)}
              placeholder="Write your note here..."
              value={field.state.value}
            />
          </FormField>
        )}
      </form.Field>

      <div className="flex gap-2">
        <form.Subscribe selector={s => s.isSubmitting}>
          {isSubmitting => (
            <button
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
              disabled={isSubmitting}
              type="submit"
            >
              Save
            </button>
          )}
        </form.Subscribe>
        <Link
          className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          to="/dashboard/notes"
        >
          Cancel
        </Link>
      </div>
    </FormShell>
  );
}

function CreateForm() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [actionError, setActionError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { title: '', content: '' },
    onSubmit: async ({ value }) => {
      setActionError(null);
      const result = await createNoteFn({
        data: { title: value.title.trim(), content: value.content.trim() }
      });
      if (!result.ok) {
        setActionError(result.message);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: notesQueryKey() });
      navigate({ to: '/dashboard/notes' });
    }
  });

  return (
    <FormShell
      actionError={actionError}
      onSubmit={() => form.handleSubmit()}
      title="New note"
    >
      <form.Field
        name="title"
        validators={{ onChange: noteInputSchema.shape.title }}
      >
        {field => (
          <FormField
            error={field.state.meta.errors[0]?.toString()}
            htmlFor="note-title"
            label="Title"
          >
            <input
              className="border-input bg-background ring-offset-background focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
              id="note-title"
              onBlur={field.handleBlur}
              onChange={e => field.handleChange(e.target.value)}
              placeholder="Note title"
              type="text"
              value={field.state.value}
            />
          </FormField>
        )}
      </form.Field>

      <form.Field name="content">
        {field => (
          <FormField htmlFor="note-content" label="Content" optional>
            <textarea
              className="border-input bg-background ring-offset-background focus:ring-ring min-h-48 w-full rounded-md border px-3 py-2 font-mono text-sm focus:ring-2 focus:outline-none"
              id="note-content"
              onBlur={field.handleBlur}
              onChange={e => field.handleChange(e.target.value)}
              placeholder="Write your note here..."
              value={field.state.value}
            />
          </FormField>
        )}
      </form.Field>

      <div className="flex gap-2">
        <form.Subscribe selector={s => s.isSubmitting}>
          {isSubmitting => (
            <button
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50"
              disabled={isSubmitting}
              type="submit"
            >
              Save
            </button>
          )}
        </form.Subscribe>
        <Link
          className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
          to="/dashboard/notes"
        >
          Cancel
        </Link>
      </div>
    </FormShell>
  );
}

function FormShell({
  title,
  actionError,
  children,
  onSubmit
}: {
  title: string;
  actionError: string | null;
  children: ReactNode;
  onSubmit: () => void;
}) {
  return (
    <>
      <Header fixed>
        <div className="flex-1" />
        <ThemeSwitcher />
      </Header>
      <Main>
        <div className="max-w-2xl space-y-6">
          <div className="flex items-center gap-3">
            <Link
              className="text-sm text-muted-foreground hover:underline"
              to="/dashboard/notes"
            >
              Notes
            </Link>
            <span className="text-muted-foreground">/</span>
            <h1 className="text-2xl font-bold">{title}</h1>
          </div>

          <ErrorBanner message={actionError} variant="error" />

          <form
            className="space-y-4"
            onSubmit={e => {
              e.preventDefault();
              onSubmit();
            }}
          >
            {children}
          </form>
        </div>
      </Main>
    </>
  );
}

export { CreateForm as NoteCreatePage, EditForm as NoteEditPage };
