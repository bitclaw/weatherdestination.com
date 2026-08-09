import type { ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/data-table/column-header';
import { Badge } from '@/components/ui/badge';
import { relativeTime } from '@/lib/utils';
import type { AuditEventRecord, JsonPayload } from '../audit-log.constants';
import { EVENT_META } from '../audit-log.constants';

const payloadPreview = (payload: JsonPayload | null): string => {
  if (!payload) return ',';
  const id = payload.id ?? payload.conversationId ?? payload.keyId;
  if (id) return `id: ${String(id).slice(0, 12)}`;
  const keys = Object.keys(payload);
  if (keys.length === 0) return ',';
  const first = keys[0];
  if (!first) return ',';
  const val = String(payload[first]).slice(0, 30);
  return `${first}: ${val}`;
};

export const getAuditLogColumns = (): ColumnDef<AuditEventRecord>[] => [
  {
    accessorKey: 'type',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Event" />
    ),
    meta: { className: 'w-56' },
    cell: ({ row }) => {
      const type = row.getValue<string>('type');
      const meta = EVENT_META[type];
      return (
        <div className="flex flex-col gap-0.5">
          <Badge className="w-fit text-xs" variant="outline">
            {meta?.label ?? type}
          </Badge>
          {meta && (
            <span className="text-xs text-muted-foreground">{meta.domain}</span>
          )}
        </div>
      );
    },
    filterFn: (row, id, value) => value.includes(row.getValue(id))
  },
  {
    accessorKey: 'payload',
    header: 'Details',
    cell: ({ row }) => {
      const payload = row.getValue<JsonPayload | null>('payload');
      return (
        <span className="font-mono text-xs text-muted-foreground">
          {payloadPreview(payload)}
        </span>
      );
    },
    enableSorting: false
  },
  {
    accessorKey: 'created_at',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Time" />
    ),
    meta: { className: 'w-36' },
    cell: ({ row }) => {
      const ts = row.getValue<number>('created_at');
      const full = new Date(ts).toLocaleString();
      return (
        <span className="text-sm text-muted-foreground" title={full}>
          {relativeTime(ts)}
        </span>
      );
    }
  }
];
