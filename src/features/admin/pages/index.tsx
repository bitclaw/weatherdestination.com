import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import {
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  useReactTable,
  type VisibilityState
} from '@tanstack/react-table';
import { useCallback, useEffect, useState } from 'react';
import { DataTablePagination } from '@/components/data-table/pagination';
import { DataTableToolbar } from '@/components/data-table/toolbar';
import { Button } from '@/components/ui/button';
import { ConfirmDialog, useConfirm } from '@/components/ui/confirm-dialog';
import { ErrorBanner } from '@/components/ui/error-banner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  adminDeleteUserFn,
  adminImpersonateUserFn,
  adminRevokeSessionsFn,
  adminToggleAccessFn,
  adminUsersQueryOptions
} from '@/features/admin';
import { authClient } from '@/lib/auth-client';
import { adminUsersQueryKey } from '@/lib/query-keys';
import { cn } from '@/lib/utils';
import { AddUserDialog } from '../components/add-user-dialog';
import { BanUserDialog } from '../components/ban-user-dialog';
import { InviteUserDialog } from '../components/invite-user-dialog';
import { getUserColumns } from '../components/users-columns';

type DialogState =
  | { type: 'add' }
  | { type: 'invite' }
  | { type: 'ban'; userId: string }
  | null;

const columnFilterValues = (
  filters: ColumnFiltersState,
  id: string
): string[] | undefined => {
  const found = filters.find(f => f.id === id)?.value as string[] | undefined;
  return found && found.length > 0 ? found : undefined;
};

export function AdminPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const { confirm, dialogProps } = useConfirm();

  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 });

  // Reset to page 1 whenever filter/search criteria change - staying on
  // e.g. page 5 of a now-much-smaller filtered result set would just show
  // an empty page instead of the matches. useCallback here isn't for
  // performance (React Compiler handles that) - it's required because this
  // fn is a useEffect dependency below.
  const resetToFirstPage = useCallback(
    () => setPagination(p => ({ ...p, pageIndex: 0 })),
    []
  );

  // Search is debounced separately from the input's own value so typing
  // feels instant while the server request (a new queryKey, not client-side
  // filtering - see below) only fires after the user pauses.
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      resetToFirstPage();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, resetToFirstPage]);

  const statusFilter = columnFilterValues(columnFilters, 'status') as
    | ('active' | 'invited' | 'banned')[]
    | undefined;
  const roleFilter = columnFilterValues(columnFilters, 'role') as
    | ('user' | 'admin')[]
    | undefined;
  const planFilter = columnFilterValues(columnFilters, 'plan');

  const queryParams = {
    page: pagination.pageIndex,
    pageSize: pagination.pageSize,
    search: debouncedSearch || undefined,
    status: statusFilter,
    role: roleFilter,
    plan: planFilter
  };
  const { data: result } = useSuspenseQuery(
    adminUsersQueryOptions(queryParams)
  );

  const users = result.users;
  const total = result.total;

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: adminUsersQueryKey() });

  const handleToggleAccess = async (userId: string, hasAccess: boolean) => {
    setError(null);
    setPending(userId);
    try {
      const res = await adminToggleAccessFn({ data: { userId, hasAccess } });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setPending(null);
    }
  };

  const handleDelete = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    const confirmed = await confirm({
      title: 'Delete user',
      description: `Permanently delete ${user?.name ?? 'this user'}? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'destructive'
    });
    if (!confirmed) return;

    setError(null);
    setPending(userId);
    try {
      const res = await adminDeleteUserFn({ data: { userId } });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      if (!res.data.deleted) {
        setError(res.data.message);
        return;
      }
      await refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setPending(null);
    }
  };

  const handleImpersonate = async (userId: string) => {
    setError(null);
    setPending(userId);
    try {
      const audit = await adminImpersonateUserFn({ data: { userId } });
      if (!audit.ok) {
        setError(audit.message);
        return;
      }
      const res = await authClient.admin.impersonateUser({ userId });
      if (res.error) {
        setError(res.error.message ?? 'Impersonation failed');
        return;
      }
      window.location.href = '/dashboard';
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setPending(null);
    }
  };

  const handleRevokeSessions = async (userId: string) => {
    setError(null);
    setPending(userId);
    try {
      const res = await adminRevokeSessionsFn({ data: { userId } });
      if (!res.ok) {
        setError(res.message);
        return;
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setPending(null);
    }
  };

  const banUser =
    dialog?.type === 'ban'
      ? (users.find(u => u.id === dialog.userId) ?? null)
      : null;

  const columns = getUserColumns({
    onToggleAccess: handleToggleAccess,
    onBan: userId => setDialog({ type: 'ban', userId }),
    onDelete: handleDelete,
    onImpersonate: handleImpersonate,
    onRevokeSessions: handleRevokeSessions,
    pending
  });

  // Manual mode throughout: users is one page of server-paginated,
  // server-filtered results (queryAdminUsers now takes limit/offset/filter -
  // see admin.server.ts), not the entire table. Sorting is intentionally
  // not wired up - sorting only the current page while the server enforces
  // global createdAt-desc order would be actively misleading, not just
  // incomplete.
  const table = useReactTable({
    data: users,
    columns,
    state: {
      columnVisibility,
      columnFilters,
      pagination,
      globalFilter: searchInput
    },
    onColumnVisibilityChange: setColumnVisibility,
    onColumnFiltersChange: updater => {
      setColumnFilters(updater);
      resetToFirstPage();
    },
    onPaginationChange: setPagination,
    onGlobalFilterChange: setSearchInput,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualFiltering: true,
    enableSorting: false,
    rowCount: total,
    pageCount: Math.max(1, Math.ceil(total / pagination.pageSize))
  });

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">User List</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your users and their roles here.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setDialog({ type: 'invite' })}
              variant="outline"
            >
              Invite User
            </Button>
            <Button onClick={() => setDialog({ type: 'add' })}>Add User</Button>
          </div>
        </div>

        <ErrorBanner message={error} variant="error" />

        <DataTableToolbar
          filters={[
            {
              columnId: 'status',
              title: 'Status',
              options: [
                { label: 'Active', value: 'active' },
                { label: 'Invited', value: 'invited' },
                { label: 'Banned', value: 'banned' }
              ]
            },
            {
              columnId: 'role',
              title: 'Role',
              options: [
                { label: 'User', value: 'user' },
                { label: 'Admin', value: 'admin' }
              ]
            },
            {
              columnId: 'plan',
              title: 'Plan',
              options: [
                { label: 'Free', value: 'free' },
                { label: 'Solo', value: 'solo' },
                { label: 'Pro', value: 'pro' },
                { label: 'Team', value: 'team' }
              ]
            }
          ]}
          searchPlaceholder="Search users..."
          table={table}
        />

        <div className="overflow-hidden rounded-md border">
          <Table>
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
                    No users yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <DataTablePagination table={table} />
      </div>

      <AddUserDialog
        onOpenChange={open => !open && setDialog(null)}
        onSuccess={refresh}
        open={dialog?.type === 'add'}
      />
      <InviteUserDialog
        onOpenChange={open => !open && setDialog(null)}
        open={dialog?.type === 'invite'}
      />
      <BanUserDialog
        onOpenChange={open => !open && setDialog(null)}
        onSuccess={refresh}
        open={dialog?.type === 'ban'}
        user={banUser}
      />
      <ConfirmDialog {...dialogProps} />
    </TooltipProvider>
  );
}
