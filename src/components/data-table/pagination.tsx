import type { Table } from '@tanstack/react-table';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { cn, getPageNumbers } from '@/lib/utils';

type DataTablePaginationProps<TData> = {
  table: Table<TData>;
  className?: string;
};

export function DataTablePagination<TData>({
  table,
  className
}: DataTablePaginationProps<TData>) {
  const currentPage = table.getState().pagination.pageIndex + 1;
  const totalPages = table.getPageCount();
  const pageNumbers = getPageNumbers(currentPage, totalPages);
  const pageItems = pageNumbers.map((value, i) => ({
    key: typeof value === 'number' ? `p-${value}` : `ellipsis-${i}`,
    value
  }));

  return (
    <div
      className={cn(
        'flex items-center justify-between overflow-clip px-2',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Select
          onValueChange={value => table.setPageSize(Number(value))}
          value={`${table.getState().pagination.pageSize}`}
        >
          <SelectTrigger className="h-8 w-[70px]">
            <SelectValue placeholder={table.getState().pagination.pageSize} />
          </SelectTrigger>
          <SelectContent side="top">
            {[10, 20, 30, 40, 50].map(pageSize => (
              <SelectItem key={pageSize} value={`${pageSize}`}>
                {pageSize}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="hidden text-sm font-medium sm:block text-muted-foreground">
          rows per page
        </p>
      </div>

      <div className="flex items-center space-x-2">
        <div className="flex w-24 items-center justify-center text-sm font-medium text-muted-foreground">
          Page {currentPage} of {totalPages}
        </div>
        <Button
          className="size-8 p-0 hidden sm:flex"
          disabled={!table.getCanPreviousPage()}
          onClick={() => table.setPageIndex(0)}
          variant="outline"
        >
          <span className="sr-only">Go to first page</span>
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          className="size-8 p-0"
          disabled={!table.getCanPreviousPage()}
          onClick={() => table.previousPage()}
          variant="outline"
        >
          <span className="sr-only">Go to previous page</span>
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {pageItems.map(({ key, value }) => (
          <div className="hidden sm:flex items-center" key={key}>
            {value === '...' ? (
              <span className="px-1 text-sm text-muted-foreground">...</span>
            ) : (
              <Button
                className="h-8 min-w-8 px-2"
                onClick={() => table.setPageIndex(value - 1)}
                variant={currentPage === value ? 'default' : 'outline'}
              >
                <span className="sr-only">Go to page {value}</span>
                {value}
              </Button>
            )}
          </div>
        ))}

        <Button
          className="size-8 p-0"
          disabled={!table.getCanNextPage()}
          onClick={() => table.nextPage()}
          variant="outline"
        >
          <span className="sr-only">Go to next page</span>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          className="size-8 p-0 hidden sm:flex"
          disabled={!table.getCanNextPage()}
          onClick={() => table.setPageIndex(table.getPageCount() - 1)}
          variant="outline"
        >
          <span className="sr-only">Go to last page</span>
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
