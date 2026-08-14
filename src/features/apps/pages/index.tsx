import { ArrowDownAZ, ArrowUpAZ, SlidersHorizontal } from 'lucide-react';
import { type ChangeEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/toast';
import { apps as initialApps } from '@/features/apps';

type FilterType = 'all' | 'connected' | 'notConnected';

const filterLabels: Record<FilterType, string> = {
  all: 'All Apps',
  connected: 'Connected',
  notConnected: 'Not Connected'
};

export function AppsPage() {
  const [apps, setApps] = useState(initialApps);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sort, setSort] = useState<'asc' | 'desc'>('asc');

  const toggleConnected = (appName: string) => {
    const wasConnected = apps.find(a => a.name === appName)?.connected;
    setApps(prev =>
      prev.map(a =>
        a.name === appName ? { ...a, connected: !a.connected } : a
      )
    );
    toast.success(
      wasConnected ? `Disconnected ${appName}` : `Connected ${appName}`
    );
  };

  const filtered = apps
    .filter(app =>
      filterType === 'connected'
        ? app.connected
        : filterType === 'notConnected'
          ? !app.connected
          : true
    )
    .filter(app => app.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) =>
      sort === 'asc'
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name)
    );

  return (
    <>
      <div>
        <h1 className="text-3xl font-bold tracking-tight">App Integrations</h1>
        <p className="text-muted-foreground">
          Connect your favorite tools to streamline your workflow.
        </p>
      </div>

      <div className="my-4 flex items-end justify-between sm:my-6 sm:items-center">
        <div className="flex flex-col gap-4 sm:flex-row">
          <Input
            className="h-9 w-40 lg:w-64"
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setSearch(e.target.value)
            }
            placeholder="Filter apps..."
            value={search}
          />
          <Select
            onValueChange={v => setFilterType(v as FilterType)}
            value={filterType}
          >
            <SelectTrigger className="w-36">
              <SelectValue>{filterLabels[filterType]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Apps</SelectItem>
              <SelectItem value="connected">Connected</SelectItem>
              <SelectItem value="notConnected">Not Connected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Select onValueChange={v => setSort(v as 'asc' | 'desc')} value={sort}>
          <SelectTrigger className="w-16">
            <SelectValue>
              <SlidersHorizontal size={18} />
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="asc">
              <div className="flex items-center gap-3">
                <ArrowUpAZ size={16} />
                <span>Ascending</span>
              </div>
            </SelectItem>
            <SelectItem value="desc">
              <div className="flex items-center gap-3">
                <ArrowDownAZ size={16} />
                <span>Descending</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {filtered.length === 0 ? (
        <p className="text-muted-foreground pt-8 text-center text-sm">
          No apps match your filters.
        </p>
      ) : (
        <ul className="faded-bottom no-scrollbar grid min-h-0 flex-1 gap-4 overflow-y-auto pt-4 pb-16 pr-2 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(app => (
            <li
              className="rounded-lg border p-4 hover:shadow-md transition-shadow"
              key={app.name}
            >
              <div className="mb-8 flex items-center justify-between">
                <div className="flex size-10 items-center justify-center rounded-lg bg-muted p-2">
                  {app.logo}
                </div>
                <Button
                  className={
                    app.connected
                      ? 'border border-info/30 bg-info/10 hover:bg-info/20'
                      : ''
                  }
                  onClick={() => toggleConnected(app.name)}
                  size="sm"
                  variant="outline"
                >
                  {app.connected ? 'Connected' : 'Connect'}
                </Button>
              </div>
              <div>
                <h2 className="mb-1 font-semibold">{app.name}</h2>
                <p className="line-clamp-2 text-muted-foreground text-sm">
                  {app.desc}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
