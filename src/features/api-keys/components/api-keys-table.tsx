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
import { deleteApiKeyFn, revokeApiKeyFn } from '@/features/api-keys';
import { apiKeysQueryKey } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import type { ApiKeyRecord } from '../api-keys.constants';
import { ApiKeyCreateDialog } from './api-key-create-dialog';
import { getApiKeysColumns, statusOptions } from './api-keys-columns';

type Props = {
  data: ApiKeyRecord[];
};

export function ApiKeysTable({ data }: Props) {
  const queryClient = useQueryClient();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [revokingKey, setRevokingKey] = useState<ApiKeyRecord | undefined>();
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [deletingKey, setDeletingKey] = useState<ApiKeyRecord | undefined>();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: apiKeysQueryKey() });

  const handleRevokeRequest = (apiKey: ApiKeyRecord) => {
    setRevokingKey(apiKey);
    setRevokeOpen(true);
  };

  const handleRevokeConfirm = async () => {
    if (!revokingKey) return;
    const result = await revokeApiKeyFn({ data: { id: revokingKey.id } });
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setRevokeOpen(false);
    setRevokingKey(undefined);
    await invalidate();
  };

  const handleDeleteRequest = (apiKey: ApiKeyRecord) => {
    setDeletingKey(apiKey);
    setDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingKey) return;
    const result = await deleteApiKeyFn({ data: { id: deletingKey.id } });
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setDeleteOpen(false);
    setDeletingKey(undefined);
    await invalidate();
  };

  const columns = getApiKeysColumns(handleRevokeRequest, handleDeleteRequest);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnFilters, columnVisibility, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
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
              options: statusOptions
            }
          ]}
          searchPlaceholder="Search keys..."
          table={table}
        />
        <Button
          className="ml-4 shrink-0"
          onClick={() => setCreateOpen(true)}
          size="sm"
        >
          <Plus className="mr-2 h-4 w-4" />
          New API key
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
                    ? 'No API keys yet. Create one to get started.'
                    : 'No results match your filters.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <DataTablePagination className="mt-auto" table={table} />

      <ApiKeyCreateDialog
        onCreated={invalidate}
        onOpenChange={setCreateOpen}
        open={createOpen}
      />

      <ConfirmDialog
        confirmLabel="Revoke"
        description={`Revoke "${revokingKey?.name}"? Any app using this key will stop working immediately.`}
        onCancel={() => {
          setRevokeOpen(false);
          setRevokingKey(undefined);
        }}
        onConfirm={handleRevokeConfirm}
        open={revokeOpen}
        title="Revoke API key"
        variant="destructive"
      />

      <ConfirmDialog
        confirmLabel="Delete"
        description={`Delete "${deletingKey?.name}"? This cannot be undone.`}
        onCancel={() => {
          setDeleteOpen(false);
          setDeletingKey(undefined);
        }}
        onConfirm={handleDeleteConfirm}
        open={deleteOpen}
        title="Delete API key"
        variant="destructive"
      />
    </div>
  );
}
