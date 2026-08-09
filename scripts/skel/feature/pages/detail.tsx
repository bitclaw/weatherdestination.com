import { useForm } from '@tanstack/react-form';
import {
  queryOptions,
  useQueryClient,
  useSuspenseQuery
} from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { Plus } from 'lucide-react';
import { type ReactNode, useState } from 'react';
// Detail queryOptions scoped by id.
// Add FEATUREDetailQueryKey to src/lib/query-keys.ts:
//   export const FEATUREDetailQueryKey = (id: string) => ['FEATURE', id] as const;
import { FEATUREDetailQueryKey, FEATUREQueryKey } from '@/lib/query-keys';
import {
  ENTITY_STATUSES,
  type EntityStatus,
  entityInputSchema
} from '../FEATURE.constants';
import {
  createEntityMutation,
  updateEntityMutation
} from '../server/FEATURE.mutations';
import { getEntityDetail } from '../server/FEATURE.queries';
import { entitiesQueryOptions } from './index';

export const entityDetailQueryOptions = (id: string) =>
  queryOptions({
    queryKey: FEATUREDetailQueryKey(id),
    queryFn: async () => {
      const result = await getEntityDetail({ data: { id } });
      if (!result.ok) throw new Error(result.message);
      return result.data;
    },
    staleTime: 30_000
  });

// Theme 6: cross-feature composition pattern.
//
// When this page needs data owned by another feature:
//   import { otherEntitiesQueryOptions } from '@/features/OTHER_FEATURE/pages';
//   const { data: others } = useSuspenseQuery(otherEntitiesQueryOptions);
//
// For related data scoped to this entity (e.g. items belonging to this entity),
// use a factory so the cache key never collides with the flat list key:
//   export const relatedItemsQueryOptions = (entityId: string) =>
//     queryOptions({
//       queryKey: ['OTHER_FEATURE', 'FEATURE', entityId],  // scoped
//       queryFn: async () => { ... },
//       staleTime: 30_000
//     });
//
// On write, invalidate both the scoped key and the global list:
//   await queryClient.invalidateQueries({ queryKey: ['OTHER_FEATURE', 'FEATURE', entityId] });
//   await queryClient.invalidateQueries({ queryKey: ['OTHER_FEATURE'] });
//
// Rules:
// - Import canonical queryOptions from the feature that owns the data , never re-declare.
// - scoped factory key shape: ['OWNER', 'SCOPE', id] , always 3 segments.
// - Two invalidation targets on write: scoped + global owner list.

const defaultValues = {
  title: '',
  status: 'active' as EntityStatus
};

const getFieldError = (errors: readonly unknown[]): string | undefined => {
  const firstError = errors[0];
  return firstError ? String(firstError) : undefined;
};

// Edit form , loads existing entity.
function EditForm({ entityId }: { entityId: string }) {
  const { data: entity } = useSuspenseQuery(entityDetailQueryOptions(entityId));

  // Theme 6 cross-feature example (uncomment when needed):
  // import { otherEntitiesQueryOptions } from '@/features/OTHER_FEATURE/pages';
  // const { data: others } = useSuspenseQuery(otherEntitiesQueryOptions);
  // No re-declaration , import the canonical options from the owning feature.

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [actionError, setActionError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      title: entity.title,
      status: entity.status
    },
    onSubmit: async ({ value }) => {
      setActionError(null);
      const result = await updateEntityMutation({
        data: {
          id: entityId,
          title: value.title.trim(),
          status: value.status
        }
      });
      if (!result.ok) {
        setActionError(result.message);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: FEATUREQueryKey() });
      navigate({ to: '/FEATURE' });
    }
  });

  return (
    <FormShell
      actionError={actionError}
      backLabel="Entities"
      backTo="/FEATURE"
      onSubmit={() => form.handleSubmit()}
      title="Edit entity"
    >
      <form.Field
        name="title"
        validators={{ onChange: entityInputSchema.shape.title }}
      >
        {field => (
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="entity-title">
              Title
            </label>
            {getFieldError(field.state.meta.errors) && (
              <p className="text-xs text-destructive">
                {getFieldError(field.state.meta.errors)}
              </p>
            )}
            <input
              className="border-input bg-background ring-offset-background focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
              id="entity-title"
              onBlur={field.handleBlur}
              onChange={e => field.handleChange(e.target.value)}
              placeholder="Entity title"
              type="text"
              value={field.state.value}
            />
          </div>
        )}
      </form.Field>

      <form.Field name="status">
        {field => (
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="entity-status">
              Status
            </label>
            <select
              className="border-input bg-background ring-offset-background focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
              id="entity-status"
              onBlur={field.handleBlur}
              onChange={e => field.handleChange(e.target.value as EntityStatus)}
              value={field.state.value}
            >
              {ENTITY_STATUSES.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
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
              <Plus className="h-4 w-4" />
              Save
            </button>
          )}
        </form.Subscribe>
        <Link
          className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted inline-flex items-center"
          to="/FEATURE"
        >
          Cancel
        </Link>
      </div>
    </FormShell>
  );
}

// Create form , no prefetch needed.
function CreateForm() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [actionError, setActionError] = useState<string | null>(null);

  const form = useForm({
    validatorAdapter: zodValidator(),
    defaultValues,
    onSubmit: async ({ value }) => {
      setActionError(null);
      const result = await createEntityMutation({
        data: {
          title: value.title.trim(),
          status: value.status
        }
      });
      if (!result.ok) {
        setActionError(result.message);
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: entitiesQueryOptions.queryKey
      });
      navigate({ to: '/FEATURE' });
    }
  });

  return (
    <FormShell
      actionError={actionError}
      backLabel="Entities"
      backTo="/FEATURE"
      onSubmit={() => form.handleSubmit()}
      title="New entity"
    >
      <form.Field
        name="title"
        validators={{ onChange: entityInputSchema.shape.title }}
      >
        {field => (
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="entity-title">
              Title
            </label>
            {getFieldError(field.state.meta.errors) && (
              <p className="text-xs text-destructive">
                {getFieldError(field.state.meta.errors)}
              </p>
            )}
            <input
              className="border-input bg-background ring-offset-background focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
              id="entity-title"
              onBlur={field.handleBlur}
              onChange={e => field.handleChange(e.target.value)}
              placeholder="Entity title"
              type="text"
              value={field.state.value}
            />
          </div>
        )}
      </form.Field>

      <form.Field name="status">
        {field => (
          <div className="space-y-1">
            <label className="text-sm font-medium" htmlFor="entity-status">
              Status
            </label>
            <select
              className="border-input bg-background ring-offset-background focus:ring-ring w-full rounded-md border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
              id="entity-status"
              onBlur={field.handleBlur}
              onChange={e => field.handleChange(e.target.value as EntityStatus)}
              value={field.state.value}
            >
              {ENTITY_STATUSES.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
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
              <Plus className="h-4 w-4" />
              Save
            </button>
          )}
        </form.Subscribe>
        <Link
          className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted inline-flex items-center"
          to="/FEATURE"
        >
          Cancel
        </Link>
      </div>
    </FormShell>
  );
}

// Shared form shell , layout, breadcrumb, error banner, form element.
function FormShell({
  title,
  actionError,
  children,
  onSubmit,
  backTo,
  backLabel
}: {
  title: string;
  actionError: string | null;
  children: ReactNode;
  onSubmit: () => void;
  backTo: string;
  backLabel: string;
}) {
  return (
    <div className="max-w-lg space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Link
          className="text-sm text-muted-foreground hover:underline"
          to={backTo}
        >
          {backLabel}
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-xl font-bold">{title}</h1>
      </div>

      {actionError && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {actionError}
        </div>
      )}

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
  );
}

export { CreateForm as FeatureCreatePage, EditForm as FeatureEditPage };
