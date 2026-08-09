import { useQueryClient } from '@tanstack/react-query';
import {
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
  type VisibilityState
} from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { DataTablePagination } from '@/components/data-table/pagination';
import { DataTableToolbar } from '@/components/data-table/toolbar';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { toast } from '@/components/ui/toast';
import {
  createFeatureRequestFn,
  deleteFeatureRequestFn,
  toggleFeatureRequestVoteFn,
  updateFeatureRequestFn
} from '@/features/feature-requests';
import { featureRequestsQueryKey } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import type { FeatureRequestRecord } from '../feature-requests.constants';
import {
  categoryOptions,
  getFeatureRequestsColumns,
  priorityOptions,
  statusOptions
} from './feature-requests-columns';
import { FeatureRequestsMutateDrawer } from './feature-requests-mutate-drawer';

type Props = {
  data: FeatureRequestRecord[];
  isAdmin: boolean;
  drawerOpen: boolean;
  editId: string | undefined;
  onOpenCreate: () => void;
  onOpenEdit: (id: string) => void;
  onCloseDrawer: () => void;
};

export function FeatureRequestsTable({
  data,
  isAdmin,
  drawerOpen,
  editId,
  onOpenCreate,
  onOpenEdit,
  onCloseDrawer
}: Props) {
  const queryClient = useQueryClient();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [rowSelection, setRowSelection] = useState({});
  const [pendingVoteId, setPendingVoteId] = useState<string | undefined>();

  const editingRequest = editId ? data.find(r => r.id === editId) : undefined;

  const [deletingRequest, setDeletingRequest] = useState<
    FeatureRequestRecord | undefined
  >();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: featureRequestsQueryKey() });

  const handleToggleVote = async (request: FeatureRequestRecord) => {
    setPendingVoteId(request.id);
    try {
      const result = await toggleFeatureRequestVoteFn({
        data: { id: request.id }
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      await invalidate();
    } finally {
      setPendingVoteId(undefined);
    }
  };

  const handleDeleteRequest = (request: FeatureRequestRecord) => {
    setDeletingRequest(request);
    setDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingRequest) return;
    const result = await deleteFeatureRequestFn({
      data: { id: deletingRequest.id }
    });
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setDeleteOpen(false);
    setDeletingRequest(undefined);
    await invalidate();
  };

  const handleDrawerSubmit = async (fields: {
    title: string;
    description: string;
    status: FeatureRequestRecord['status'];
    priority: FeatureRequestRecord['priority'];
    category: FeatureRequestRecord['category'];
  }) => {
    if (editingRequest) {
      // Admin triage edit - full field set (see updateFeatureRequestSchema).
      const result = await updateFeatureRequestFn({
        data: { id: editingRequest.id, ...fields }
      });
      if (!result.ok) throw new Error(result.message);
    } else {
      // Any user's submission - status/priority aren't settable at creation,
      // they default server-side and get set by admin triage (see
      // createFeatureRequestSchema).
      const result = await createFeatureRequestFn({
        data: {
          title: fields.title,
          description: fields.description,
          category: fields.category
        }
      });
      if (!result.ok) throw new Error(result.message);
    }
    await invalidate();
  };

  const columns = getFeatureRequestsColumns(
    isAdmin,
    (req: FeatureRequestRecord) => onOpenEdit(req.id),
    handleDeleteRequest,
    handleToggleVote,
    pendingVoteId
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
      rowSelection
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues()
  });

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <DataTableToolbar
          filters={[
            {
              columnId: 'status',
              title: 'Status',
              options: statusOptions as unknown as {
                label: string;
                value: string;
                icon?: React.ComponentType<{ className?: string }>;
              }[]
            },
            {
              columnId: 'priority',
              title: 'Priority',
              options: priorityOptions as unknown as {
                label: string;
                value: string;
                icon?: React.ComponentType<{ className?: string }>;
              }[]
            },
            {
              columnId: 'category',
              title: 'Category',
              options: categoryOptions as unknown as {
                label: string;
                value: string;
              }[]
            }
          ]}
          searchPlaceholder="Search requests..."
          table={table}
        />
        <Button className="ml-4 shrink-0" onClick={onOpenCreate} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          New request
        </Button>
      </div>

      <div className="overflow-auto rounded-md border">
        <Table className="min-w-xl">
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <TableHead
                    className={cn(
                      header.column.columnDef.meta?.className,
                      header.column.columnDef.meta?.thClassName
                    )}
                    colSpan={header.colSpan}
                    key={header.id}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map(row => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map(cell => (
                    <TableCell
                      className={cn(
                        cell.column.columnDef.meta?.className,
                        cell.column.columnDef.meta?.tdClassName
                      )}
                      key={cell.id}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  className="h-24 text-center text-muted-foreground"
                  colSpan={columns.length}
                >
                  {data.length === 0
                    ? 'No feature requests yet. Submit one to get started.'
                    : 'No results match your filters.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <DataTablePagination className="mt-auto" table={table} />

      <FeatureRequestsMutateDrawer
        currentRow={editingRequest}
        // key remounts the drawer per row: its form state is useState seeded
        // from currentRow at mount, so without this, editing row A (or A then
        // B) shows and saves stale values from the previous mount.
        key={editingRequest?.id ?? 'create'}
        onOpenChange={open => {
          if (!open) onCloseDrawer();
        }}
        onSubmit={handleDrawerSubmit}
        open={drawerOpen}
      />

      <ConfirmDialog
        confirmLabel="Delete"
        description={`Delete "${deletingRequest?.title}"? This cannot be undone.`}
        onCancel={() => {
          setDeleteOpen(false);
          setDeletingRequest(undefined);
        }}
        onConfirm={handleDeleteConfirm}
        open={deleteOpen}
        title="Delete feature request"
        variant="destructive"
      />
    </div>
  );
}
