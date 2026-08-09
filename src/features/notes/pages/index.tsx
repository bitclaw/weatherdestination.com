import {
  useQuery,
  useQueryClient,
  useSuspenseQuery
} from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { Pencil, Pin, PinOff, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { Button } from '@/components/ui/button';
import { ErrorBanner } from '@/components/ui/error-banner';
import { EntitlementGate, subscriptionQueryOptions } from '@/features/billing';
import type { NoteRecord } from '@/features/notes';
import {
  deleteNoteFn,
  noteDetailQueryOptions,
  notesQueryOptions,
  togglePinFn
} from '@/features/notes';
import type { PlanKey } from '@/lib/entitlements';
import { checkEntitlement } from '@/lib/entitlements';
import { notesQueryKey } from '@/lib/query-keys';
import { cn, relativeTime } from '@/lib/utils';

export function NotesPage() {
  const { data: notes } = useSuspenseQuery(notesQueryOptions);
  const { data: sub } = useQuery(subscriptionQueryOptions);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const plan = (sub?.plan ?? 'free') as PlanKey;
  const entitlement = checkEntitlement(plan, 'maxNotes', notes.length);

  const filtered = search.trim()
    ? notes.filter(
        n =>
          n.title.toLowerCase().includes(search.toLowerCase()) ||
          n.content.toLowerCase().includes(search.toLowerCase())
      )
    : notes;

  const handleDelete = async (note: NoteRecord) => {
    setActionError(null);
    const result = await deleteNoteFn({ data: { id: note.id } });
    if (!result.ok) {
      setActionError(result.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: notesQueryKey() });
  };

  const handleTogglePin = async (note: NoteRecord) => {
    setActionError(null);
    const result = await togglePinFn({ data: { id: note.id } });
    if (!result.ok) {
      setActionError(result.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: notesQueryKey() });
  };

  return (
    <>
      <Header fixed>
        <div className="flex-1" />
        <ThemeSwitcher />
      </Header>
      <Main>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Notes</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Your private notes, organized and searchable.
              </p>
            </div>
            <EntitlementGate
              allowed={entitlement.allowed}
              limit={entitlement.limit}
              resource="notes"
              used={entitlement.used}
            >
              <Link
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                to="/dashboard/notes/new"
              >
                <Plus className="h-4 w-4" />
                New note
              </Link>
            </EntitlementGate>
          </div>

          <ErrorBanner message={actionError} variant="error" />

          <input
            className="border-input bg-background ring-offset-background focus:ring-ring w-full max-w-sm rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
            onChange={e => setSearch(e.target.value)}
            placeholder="Search notes..."
            type="search"
            value={search}
          />

          {filtered.length === 0 ? (
            <div className="rounded-md border py-12 text-center text-sm text-muted-foreground">
              {notes.length === 0 ? (
                <>
                  No notes yet.{' '}
                  <Link
                    className="text-primary hover:underline"
                    to="/dashboard/notes/new"
                  >
                    Create one.
                  </Link>
                </>
              ) : (
                'No results.'
              )}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map(note => (
                <div
                  className={cn(
                    'group relative flex flex-col gap-2 rounded-lg border p-4 transition-colors hover:bg-accent/50',
                    note.pinned && 'border-primary/30 bg-primary/5'
                  )}
                  key={note.id}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() =>
                        navigate({
                          to: '/dashboard/notes/$id',
                          params: { id: note.id }
                        })
                      }
                      onMouseEnter={() =>
                        queryClient.prefetchQuery(
                          noteDetailQueryOptions(note.id)
                        )
                      }
                      type="button"
                    >
                      <p className="truncate font-medium leading-snug">
                        {note.title}
                      </p>
                    </button>
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button
                        className="size-7"
                        onClick={() => handleTogglePin(note)}
                        size="icon"
                        title={note.pinned ? 'Unpin' : 'Pin'}
                        variant="ghost"
                      >
                        {note.pinned ? (
                          <PinOff className="h-3.5 w-3.5" />
                        ) : (
                          <Pin className="h-3.5 w-3.5" />
                        )}
                      </Button>
                      <Link
                        className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted"
                        params={{ id: note.id }}
                        title="Edit note"
                        to="/dashboard/notes/$id"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Link>
                      <button
                        className="rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
                        onClick={() => handleDelete(note)}
                        title="Delete note"
                        type="button"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {note.content && (
                    <p className="line-clamp-3 text-xs text-muted-foreground">
                      {note.content}
                    </p>
                  )}

                  <p className="mt-auto text-xs text-muted-foreground">
                    {relativeTime(note.updated_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </Main>
    </>
  );
}
