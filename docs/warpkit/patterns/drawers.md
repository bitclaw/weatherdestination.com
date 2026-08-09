# Drawer Pattern

Two patterns depending on intent.

## CRUD drawers (create / edit)

URL-driven. Open state lives in search params so the back button closes the drawer, refreshes preserve state, and links are deep-linkable.

### Route setup

```ts
export const Route = createFileRoute('/_app/dashboard/my-feature/')({
  validateSearch: (s: Record<string, unknown>) => ({
    drawer: s.drawer as 'create' | 'edit' | undefined,
    id: s.id as string | undefined
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(myQueryOptions);
  },
  component: MyPage
});
```

### Route component

Own all drawer state here. Use `Route.useSearch()` and `useNavigate({ from: Route.fullPath })`. Pass handlers as props to child components.

```tsx
function MyPage() {
  const { data } = useSuspenseQuery(myQueryOptions);
  const { drawer, id } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });

  const drawerOpen = drawer === 'create' || drawer === 'edit';
  // TSR requires all validateSearch keys present, pass undefined to clear
  const openCreate = () => navigate({ search: { drawer: 'create', id: undefined } });
  const openEdit = (editId: string) => navigate({ search: { drawer: 'edit', id: editId } });
  const closeDrawer = () => navigate({ search: { drawer: undefined, id: undefined } });

  return (
    <MyTable
      data={data}
      drawerOpen={drawerOpen}
      editId={id}
      onOpenCreate={openCreate}
      onOpenEdit={openEdit}
      onCloseDrawer={closeDrawer}
    />
  );
}
```

### Table / list component

Receive state as props. Derive `editingRow` from `editId`. Wire `onOpenChange` to close.

```tsx
type Props = {
  data: MyRecord[];
  drawerOpen: boolean;
  editId: string | undefined;
  onOpenCreate: () => void;
  onOpenEdit: (id: string) => void;
  onCloseDrawer: () => void;
};

export function MyTable({ data, drawerOpen, editId, onOpenCreate, onOpenEdit, onCloseDrawer }: Props) {
  const editingRow = editId ? data.find(r => r.id === editId) : undefined;

  return (
    <>
      {/* table with onOpenEdit callback in row actions */}
      <MyMutateDrawer
        currentRow={editingRow}
        open={drawerOpen}
        onOpenChange={open => { if (!open) onCloseDrawer(); }}
        onSubmit={handleSubmit}
      />
    </>
  );
}
```

**Do not** call `useSearch({ from: '...' })` in child components. TSR's `from` path oscillates between route ID form (`/_app/dashboard/...`) and URL form (`/dashboard/...`) across route tree regenerations, causing TypeScript errors. `Route.useSearch()` in the route file is unambiguous.

## Confirmation dialogs (destructive actions)

Component state. These are transient and have no URL identity.

```ts
const [deleteOpen, setDeleteOpen] = useState(false);
const [deletingRow, setDeletingRow] = useState<MyRecord | undefined>();

const handleDeleteRequest = (row: MyRecord) => {
  setDeletingRow(row);
  setDeleteOpen(true);
};
```

## Reference implementation

`src/features/feature-requests/components/feature-requests-table.tsx` and `src/routes/_app.dashboard.feature-requests.index.tsx`.
