import type { ColumnDef } from '@tanstack/react-table';
import {
  AlertCircle,
  ArrowBigUp,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Calendar,
  CheckCircle2,
  Circle,
  MoreHorizontal,
  Timer,
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
import { cn } from '@/lib/utils';
import type { FeatureRequestRecord } from '../feature-requests.constants';

export const statusOptions = [
  { label: 'Submitted', value: 'submitted', icon: Circle },
  { label: 'Planned', value: 'planned', icon: Calendar },
  { label: 'In Progress', value: 'in_progress', icon: Timer },
  { label: 'Shipped', value: 'shipped', icon: CheckCircle2 },
  { label: 'Declined', value: 'declined', icon: XCircle }
] as const;

export const priorityOptions = [
  { label: 'Low', value: 'low', icon: ArrowDown },
  { label: 'Medium', value: 'medium', icon: ArrowRight },
  { label: 'High', value: 'high', icon: ArrowUp },
  { label: 'Critical', value: 'critical', icon: AlertCircle }
] as const;

export const categoryOptions = [
  { label: 'UI / UX', value: 'ui_ux' },
  { label: 'Performance', value: 'performance' },
  { label: 'Integration', value: 'integration' },
  { label: 'Billing', value: 'billing' },
  { label: 'Other', value: 'other' }
] as const;

type RowActionsProps = {
  request: FeatureRequestRecord;
  onEdit: (request: FeatureRequestRecord) => void;
  onDelete: (request: FeatureRequestRecord) => void;
};

const RowActions = ({ request, onEdit, onDelete }: RowActionsProps) => (
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
      <DropdownMenuItem onClick={() => onEdit(request)}>Edit</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        className="text-destructive focus:text-destructive"
        onClick={() => onDelete(request)}
      >
        Delete
        <Trash2 className="ml-auto h-4 w-4" />
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

type VoteButtonProps = {
  request: FeatureRequestRecord;
  onToggleVote: (request: FeatureRequestRecord) => void;
  pending: boolean;
};

const VoteButton = ({ request, onToggleVote, pending }: VoteButtonProps) => (
  <Button
    aria-pressed={request.votedByMe}
    className={cn(
      'flex h-auto min-w-12 flex-col items-center gap-0.5 px-2 py-1.5',
      request.votedByMe && 'border-primary text-primary'
    )}
    disabled={pending}
    onClick={() => onToggleVote(request)}
    size="sm"
    variant={request.votedByMe ? 'outline' : 'ghost'}
  >
    <ArrowBigUp
      className={cn('h-4 w-4', request.votedByMe && 'fill-current')}
    />
    <span className="text-xs font-medium tabular-nums">
      {request.voteCount}
    </span>
  </Button>
);

export const getFeatureRequestsColumns = (
  isAdmin: boolean,
  onEdit: (request: FeatureRequestRecord) => void,
  onDelete: (request: FeatureRequestRecord) => void,
  onToggleVote: (request: FeatureRequestRecord) => void,
  pendingVoteId: string | undefined
): ColumnDef<FeatureRequestRecord>[] => [
  {
    id: 'vote',
    header: 'Votes',
    enableSorting: false,
    enableHiding: false,
    cell: ({ row }) => (
      <VoteButton
        onToggleVote={onToggleVote}
        pending={pendingVoteId === row.original.id}
        request={row.original}
      />
    )
  },
  {
    accessorKey: 'title',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Title" />
    ),
    meta: { className: 'max-w-0 w-2/3' },
    cell: ({ row }) => {
      const cat = categoryOptions.find(c => c.value === row.original.category);
      return (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            {cat && <Badge variant="outline">{cat.label}</Badge>}
            <span className="truncate font-medium">
              {row.getValue('title')}
            </span>
          </div>
          {row.original.description && (
            <span className="truncate text-xs text-muted-foreground">
              {row.original.description}
            </span>
          )}
        </div>
      );
    }
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = statusOptions.find(
        s => s.value === row.getValue('status')
      );
      if (!status) return null;
      const Icon = status.icon;
      return (
        <div className="flex w-32 items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span>{status.label}</span>
        </div>
      );
    },
    filterFn: (row, id, value) => value.includes(row.getValue(id))
  },
  {
    accessorKey: 'priority',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Priority" />
    ),
    cell: ({ row }) => {
      const priority = priorityOptions.find(
        p => p.value === row.getValue('priority')
      );
      if (!priority) return null;
      const Icon = priority.icon;
      return (
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span>{priority.label}</span>
        </div>
      );
    },
    filterFn: (row, id, value) => value.includes(row.getValue(id))
  },
  {
    accessorKey: 'category',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Category" />
    ),
    cell: ({ row }) => {
      const cat = categoryOptions.find(
        c => c.value === row.getValue('category')
      );
      return (
        <span className="text-sm">
          {cat?.label ?? row.getValue('category')}
        </span>
      );
    },
    filterFn: (row, id, value) => value.includes(row.getValue(id))
  },
  // Triage (edit status/priority/delete) is admin-only - see
  // updateFeatureRequestFn/deleteFeatureRequestFn's requireAdmin() gate.
  // Hiding the column for non-admins isn't the security boundary, just UX;
  // the server enforces it regardless.
  ...(isAdmin
    ? [
        {
          id: 'actions',
          cell: ({ row }: { row: { original: FeatureRequestRecord } }) => (
            <RowActions
              onDelete={onDelete}
              onEdit={onEdit}
              request={row.original}
            />
          )
        }
      ]
    : [])
];
