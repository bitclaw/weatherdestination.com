# DataTable

A full-featured sortable, filterable, paginated table built on TanStack Table. Used by the API keys, audit log, feature requests, and admin users pages.

## Components

All DataTable sub-components live in `src/components/data-table/`:

| File | Purpose |
|------|---------|
| `table.tsx` | Core `<DataTable>` component |
| `column-header.tsx` | `<DataTableColumnHeader>` , sortable column header |
| `toolbar.tsx` | `<DataTableToolbar>` , search input + filters |
| `pagination.tsx` | `<DataTablePagination>` , page controls |
| `faceted-filter.tsx` | `<DataTableFacetedFilter>` , multi-select filter |
| `view-options.tsx` | `<DataTableViewOptions>` , column visibility toggle |

## Usage

Define columns with TanStack Table's `ColumnDef`, then pass data and columns to `<DataTable>`:

```tsx
import { DataTable } from '@/components/data-table/table';
import { DataTableToolbar } from '@/components/data-table/toolbar';
import { DataTablePagination } from '@/components/data-table/pagination';
import type { ColumnDef } from '@tanstack/react-table';

type Item = { id: string; name: string; status: string };

const columns: ColumnDef<Item>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => <DataTableColumnHeader column={column} title="Name" />,
  },
  {
    accessorKey: 'status',
    header: 'Status',
  },
];

function MyTable({ data }: { data: Item[] }) {
  return (
    <DataTable
      columns={columns}
      data={data}
      toolbar={table => <DataTableToolbar table={table} />}
      pagination={table => <DataTablePagination table={table} />}
    />
  );
}
```

Reference implementations: `src/features/api-keys/components/api-keys-table.tsx`, `src/features/audit-log/components/audit-log-table.tsx`.
