import type { Table } from '@tanstack/react-table';
import { X } from 'lucide-react';
import type * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTableFacetedFilter } from './faceted-filter';
import { DataTableViewOptions } from './view-options';

type DataTableToolbarProps<TData> = {
  table: Table<TData>;
  searchPlaceholder?: string;
  searchKey?: string;
  filters?: {
    columnId: string;
    title: string;
    options: readonly {
      label: string;
      value: string;
      icon?: React.ComponentType<{ className?: string }>;
    }[];
  }[];
};

export function DataTableToolbar<TData>({
  table,
  searchPlaceholder = 'Filter...',
  searchKey,
  filters = []
}: DataTableToolbarProps<TData>) {
  const isFiltered =
    table.getState().columnFilters.length > 0 || table.getState().globalFilter;

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 flex-col-reverse items-start gap-y-2 sm:flex-row sm:items-center sm:space-x-2">
        {searchKey ? (
          <Input
            className="h-8 w-40 lg:w-64"
            onChange={event =>
              table.getColumn(searchKey)?.setFilterValue(event.target.value)
            }
            placeholder={searchPlaceholder}
            value={
              (table.getColumn(searchKey)?.getFilterValue() as string) ?? ''
            }
          />
        ) : (
          <Input
            className="h-8 w-40 lg:w-64"
            onChange={event => table.setGlobalFilter(event.target.value)}
            placeholder={searchPlaceholder}
            value={table.getState().globalFilter ?? ''}
          />
        )}
        <div className="flex gap-x-2">
          {filters.map(filter => {
            const column = table.getColumn(filter.columnId);
            if (!column) return null;
            return (
              <DataTableFacetedFilter
                column={column}
                key={filter.columnId}
                options={filter.options}
                title={filter.title}
              />
            );
          })}
        </div>
        {isFiltered && (
          <Button
            className="h-8 px-2 lg:px-3"
            onClick={() => {
              table.resetColumnFilters();
              table.setGlobalFilter('');
            }}
            variant="ghost"
          >
            Reset
            <X className="ms-2 h-4 w-4" />
          </Button>
        )}
      </div>
      <DataTableViewOptions table={table} />
    </div>
  );
}
