import type { ColumnDef } from '@tanstack/react-table';
import {
  CheckCircle2,
  Copy,
  MoreHorizontal,
  Trash2,
  XCircle
} from 'lucide-react';
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
import { relativeTime } from '@/lib/utils';
import type { ApiKeyRecord } from '../api-keys.constants';

export const statusOptions = [
  { label: 'Active', value: 'active', icon: CheckCircle2 },
  { label: 'Revoked', value: 'revoked', icon: XCircle }
] as const;

type RowActionsProps = {
  apiKey: ApiKeyRecord;
  onRevoke: (apiKey: ApiKeyRecord) => void;
  onDelete: (apiKey: ApiKeyRecord) => void;
};

const RowActions = ({ apiKey, onRevoke, onDelete }: RowActionsProps) => (
  <DropdownMenu modal={false}>
    <DropdownMenuTrigger asChild>
      <Button
        className="flex h-8 w-8 p-0 data-[state=open]:bg-muted"
        variant="ghost"
      >
        <MoreHorizontal className="h-4 w-4" />
        <span className="sr-only">Open menu</span>
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="w-36">
      <DropdownMenuItem
        disabled={apiKey.status === 'revoked'}
        onClick={() => onRevoke(apiKey)}
      >
        Revoke
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        className="text-destructive focus:text-destructive"
        onClick={() => onDelete(apiKey)}
      >
        Delete
        <Trash2 className="ml-auto h-4 w-4" />
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

export const getApiKeysColumns = (
  onRevoke: (apiKey: ApiKeyRecord) => void,
  onDelete: (apiKey: ApiKeyRecord) => void
): ColumnDef<ApiKeyRecord>[] => [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    meta: { className: 'max-w-0 w-1/3' },
    cell: ({ row }) => (
      <span className="truncate font-medium">{row.getValue('name')}</span>
    )
  },
  {
    accessorKey: 'keyPreview',
    header: 'Key',
    cell: ({ row }) => {
      const preview = row.getValue<string>('keyPreview');
      return (
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">
            {preview}
          </span>
          <Button
            className="h-6 w-6 p-0 opacity-50 hover:opacity-100"
            onClick={() => navigator.clipboard.writeText(preview)}
            size="icon"
            title="Copy key preview"
            variant="ghost"
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      );
    },
    enableSorting: false
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = row.getValue<string>('status');
      const isActive = status === 'active';
      return (
        <div className="flex items-center gap-2">
          {isActive ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : (
            <XCircle className="h-4 w-4 text-muted-foreground" />
          )}
          <Badge variant={isActive ? 'outline' : 'secondary'}>
            {isActive ? 'Active' : 'Revoked'}
          </Badge>
        </div>
      );
    },
    filterFn: (row, id, value) => value.includes(row.getValue(id))
  },
  {
    accessorKey: 'last_used_at',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Last used" />
    ),
    cell: ({ row }) => {
      const ts = row.getValue<number | null>('last_used_at');
      return (
        <span className="text-sm text-muted-foreground">
          {ts ? relativeTime(ts) : 'Never'}
        </span>
      );
    }
  },
  {
    accessorKey: 'created_at',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created" />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {relativeTime(row.getValue<number>('created_at'))}
      </span>
    )
  },
  {
    id: 'actions',
    cell: ({ row }) => (
      <RowActions
        apiKey={row.original}
        onDelete={onDelete}
        onRevoke={onRevoke}
      />
    )
  }
];
