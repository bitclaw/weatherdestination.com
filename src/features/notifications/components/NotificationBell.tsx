import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { toast } from '@/components/ui/toast';
import {
  markAllReadFn,
  markReadFn,
  notificationsQueryOptions
} from '@/features/notifications';
import { notificationsQueryKey } from '@/lib/query-keys';
import { cn, relativeTime } from '@/lib/utils';

export const NotificationBell = () => {
  const queryClient = useQueryClient();
  const { data: notifications = [] } = useQuery(notificationsQueryOptions);

  const unreadCount = notifications.filter(n => n.read === 0).length;

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: notificationsQueryKey() });

  const handleClickNotification = async (id: string, href: string | null) => {
    const markResult = await markReadFn({ data: { id } });
    if (!markResult.ok) {
      toast.error(markResult.message);
      return;
    }
    await refresh();
    if (href) {
      window.location.href = href;
    }
  };

  const handleMarkAllRead = async () => {
    const markResult = await markAllReadFn({ data: {} });
    if (!markResult.ok) {
      toast.error(markResult.message);
      return;
    }
    await refresh();
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button className="relative" size="icon" variant="ghost">
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex size-2 rounded-full bg-info" />
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <span className="font-medium">Notifications</span>
          {unreadCount > 0 && (
            <Button
              className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
              onClick={handleMarkAllRead}
              variant="ghost"
            >
              Mark all read
            </Button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
              <Bell className="size-6 opacity-40" />
              <span>No notifications yet</span>
            </div>
          ) : (
            notifications.map(n => (
              <button
                className={cn(
                  'flex w-full flex-col gap-0.5 px-4 py-3 text-left transition-colors hover:bg-muted/50',
                  n.read === 0 && 'bg-muted/20'
                )}
                key={n.id}
                onClick={() => handleClickNotification(n.id, n.href)}
                type="button"
              >
                <div className="flex items-center gap-2">
                  {n.read === 0 && (
                    <span className="size-1.5 shrink-0 rounded-full bg-info" />
                  )}
                  <span
                    className={cn(
                      'text-sm',
                      n.read === 0 ? 'font-medium' : 'text-muted-foreground'
                    )}
                  >
                    {n.title}
                  </span>
                </div>
                {n.body && (
                  <p className="pl-3.5 text-xs text-muted-foreground line-clamp-2">
                    {n.body}
                  </p>
                )}
                <span className="pl-3.5 text-xs text-muted-foreground/60">
                  {relativeTime(n.created_at)}
                </span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
