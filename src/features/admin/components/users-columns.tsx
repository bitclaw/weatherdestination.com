import { Link } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { MoreHorizontal, ShieldCheck, User } from 'lucide-react';
import { DataTableColumnHeader } from '@/components/data-table/column-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip';
import type { AdminUser } from '@/features/admin';

export type UserStatus = 'active' | 'invited' | 'banned';

export const deriveStatus = (u: AdminUser): UserStatus => {
  if (u.banned) return 'banned';
  if (!u.emailVerified) return 'invited';
  return 'active';
};

type ActionHandlers = {
  onToggleAccess: (userId: string, hasAccess: boolean) => void;
  onBan: (userId: string) => void;
  onDelete: (userId: string) => void;
  onImpersonate: (userId: string) => void;
  onRevokeSessions: (userId: string) => void;
  pending: string | null;
};

export const getUserColumns = (
  handlers: ActionHandlers
): ColumnDef<AdminUser>[] => [
  {
    id: 'user',
    accessorFn: row => `${row.name} ${row.email}`,
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="User" />
    ),
    cell: ({ row }) => (
      <Link
        className="hover:underline"
        params={{ userId: row.original.id }}
        to="/dashboard/admin/$userId"
      >
        <p className="font-medium">{row.original.name}</p>
        <p className="text-xs text-muted-foreground">{row.original.email}</p>
      </Link>
    )
  },
  {
    accessorKey: 'role',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Role" />
    ),
    cell: ({ row }) => (
      <Badge variant={row.original.role === 'admin' ? 'default' : 'secondary'}>
        {row.original.role === 'admin' ? (
          <ShieldCheck className="me-1 size-3" />
        ) : (
          <User className="me-1 size-3" />
        )}
        {row.original.role}
      </Badge>
    ),
    filterFn: (row, id, value: string[]) => value.includes(row.getValue(id))
  },
  {
    id: 'status',
    accessorFn: row => deriveStatus(row),
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = deriveStatus(row.original);
      if (status === 'active')
        return (
          <Badge className="bg-teal-100 text-teal-800 hover:bg-teal-100 dark:bg-teal-900/30 dark:text-teal-400">
            active
          </Badge>
        );
      if (status === 'invited')
        return (
          <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100 dark:bg-sky-900/30 dark:text-sky-400">
            invited
          </Badge>
        );
      return <Badge variant="destructive">banned</Badge>;
    },
    filterFn: (row, id, value: string[]) => value.includes(row.getValue(id))
  },
  {
    accessorKey: 'plan',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Plan" />
    ),
    cell: ({ row }) => (
      <Badge variant={row.original.plan !== 'free' ? 'default' : 'outline'}>
        {row.original.plan}
      </Badge>
    ),
    filterFn: (row, id, value: string[]) => value.includes(row.getValue(id))
  },
  {
    accessorKey: 'hasAccess',
    header: 'Access',
    cell: ({ row }) => (
      <Tooltip>
        <TooltipTrigger asChild>
          <Switch
            checked={row.original.hasAccess}
            disabled={handlers.pending === row.original.id}
            onCheckedChange={checked =>
              handlers.onToggleAccess(row.original.id, checked)
            }
          />
        </TooltipTrigger>
        <TooltipContent>
          Pro/paid access, independent of login. Does not affect whether the
          user can sign in.
        </TooltipContent>
      </Tooltip>
    ),
    enableSorting: false
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Joined" />
    ),
    cell: ({ row }) =>
      row.original.createdAt.toLocaleDateString('en-US', { timeZone: 'UTC' })
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const user = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="size-8 p-0" variant="ghost">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link params={{ userId: user.id }} to="/dashboard/admin/$userId">
                View details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handlers.onImpersonate(user.id)}>
              Impersonate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handlers.onBan(user.id)}>
              {user.banned ? 'Unban' : 'Ban'}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handlers.onRevokeSessions(user.id)}
            >
              Revoke sessions
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => handlers.onDelete(user.id)}
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
    enableSorting: false,
    enableHiding: false
  }
];
