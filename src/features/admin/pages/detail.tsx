import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  ArrowLeft,
  Award,
  Ban,
  CheckCircle2,
  ShieldCheck,
  Trash2,
  User,
  UserCog
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmDialog, useConfirm } from '@/components/ui/confirm-dialog';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip';
import {
  adminBanUserFn,
  adminDeleteUserFn,
  adminImpersonateUserFn,
  adminListUserSessionsFn,
  adminRevokeSessionsFn,
  adminSetRoleFn,
  adminToggleAccessFn,
  adminUnbanUserFn,
  adminUserDetailQueryOptions
} from '@/features/admin';
import { useAsyncAction } from '@/hooks/use-async-action';
import { authClient } from '@/lib/auth-client';
import { adminUserDetailQueryKey, adminUsersQueryKey } from '@/lib/query-keys';
import { relativeTime } from '@/lib/utils';

type SessionRow = {
  id: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string | Date;
  expiresAt: string | Date;
};

type Props = {
  userId: string;
};

export function AdminUserDetailPage({ userId }: Props) {
  const queryClient = useQueryClient();
  const { data: user } = useSuspenseQuery(adminUserDetailQueryOptions(userId));
  const { pending, error, setError, run } = useAsyncAction();
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const { confirm, dialogProps } = useConfirm();

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: adminUsersQueryKey() }),
      queryClient.invalidateQueries({
        queryKey: adminUserDetailQueryKey(userId)
      })
    ]);

  if (!user) {
    return (
      <div className="space-y-4">
        <Link
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          to="/dashboard/admin"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Admin
        </Link>
        <p className="text-sm text-muted-foreground">User not found.</p>
      </div>
    );
  }

  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const res = await adminListUserSessionsFn({ data: { userId: user.id } });
      if (res.ok) setSessions(res.data as SessionRow[]);
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleToggleAccess = (hasAccess: boolean) =>
    run(async () => {
      const res = await adminToggleAccessFn({
        data: { userId: user.id, hasAccess }
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      await refresh();
    });

  const handleSetRole = (role: 'user' | 'admin') =>
    run(async () => {
      const res = await adminSetRoleFn({ data: { userId: user.id, role } });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      await refresh();
    });

  const handleBan = () =>
    run(async () => {
      const res = await adminBanUserFn({ data: { userId: user.id } });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      await refresh();
    });

  const handleUnban = () =>
    run(async () => {
      const res = await adminUnbanUserFn({ data: { userId: user.id } });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      await refresh();
    });

  const handleRevokeSessions = () =>
    run(async () => {
      const res = await adminRevokeSessionsFn({ data: { userId: user.id } });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setSessions([]);
    });

  const handleImpersonate = () =>
    run(async () => {
      const audit = await adminImpersonateUserFn({ data: { userId: user.id } });
      if (!audit.ok) {
        setError(audit.message);
        return;
      }
      const res = await authClient.admin.impersonateUser({
        userId: user.id
      });
      if (res.error) {
        setError(res.error.message ?? 'Impersonation failed');
        return;
      }
      window.location.href = '/dashboard';
    });

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: 'Delete user',
      description: `Permanently delete ${user.name}? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'destructive'
    });
    if (!confirmed) return;

    await run(async () => {
      const res = await adminDeleteUserFn({ data: { userId: user.id } });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      if (!res.data.deleted) {
        setError(res.data.message);
        return;
      }
      window.location.href = '/dashboard/admin';
    });
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="space-y-2">
          <Link
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            to="/dashboard/admin"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Admin
          </Link>
          <h1 className="text-3xl font-bold">{user.name}</h1>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>

        <ErrorBanner message={error} variant="error" />

        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-6 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Plan</p>
              <Badge
                className="-ml-2"
                variant={user.plan !== 'free' ? 'default' : 'outline'}
              >
                {user.plan}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Joined</p>
              <p>
                {user.createdAt.toLocaleDateString('en-US', {
                  timeZone: 'UTC'
                })}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Role &amp; Access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Role</p>
                <Badge
                  className="-ml-2"
                  variant={user.role === 'admin' ? 'default' : 'secondary'}
                >
                  {user.role === 'admin' ? (
                    <ShieldCheck className="me-1 size-3" />
                  ) : (
                    <User className="me-1 size-3" />
                  )}
                  {user.role}
                </Badge>
              </div>
              <Button
                disabled={pending}
                onClick={() =>
                  handleSetRole(user.role === 'admin' ? 'user' : 'admin')
                }
                size="sm"
                variant="outline"
              >
                <Award className="h-4 w-4" />
                {user.role === 'admin' ? 'Demote to user' : 'Promote to admin'}
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Pro / paid access</p>
                <p className="text-xs text-muted-foreground">
                  Independent of login. Does not affect whether the user can
                  sign in.
                </p>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Switch
                    checked={user.hasAccess}
                    disabled={pending}
                    onCheckedChange={handleToggleAccess}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  Grants Pro/paid feature access, independent of login
                </TooltipContent>
              </Tooltip>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Ban status</p>
                {user.banned ? (
                  <Badge className="-ml-2" variant="destructive">
                    Banned{user.banReason ? `: ${user.banReason}` : ''}
                  </Badge>
                ) : (
                  <p className="text-xs text-muted-foreground">Not banned</p>
                )}
              </div>
              {user.banned ? (
                <Button
                  disabled={pending}
                  onClick={handleUnban}
                  size="sm"
                  variant="outline"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Unban
                </Button>
              ) : (
                <Button
                  disabled={pending}
                  onClick={handleBan}
                  size="sm"
                  variant="outline"
                >
                  <Ban className="h-4 w-4" />
                  Ban
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sessions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Button
                disabled={loadingSessions}
                onClick={loadSessions}
                size="sm"
                variant="outline"
              >
                {loadingSessions ? 'Loading...' : 'Load sessions'}
              </Button>
              <Button
                disabled={pending}
                onClick={handleRevokeSessions}
                size="sm"
                variant="outline"
              >
                Revoke all sessions
              </Button>
            </div>
            {sessions && (
              <div className="space-y-1">
                {sessions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No active sessions.
                  </p>
                ) : (
                  sessions.map(s => (
                    <div
                      className="flex items-center gap-4 text-xs text-muted-foreground"
                      key={s.id}
                    >
                      <span className="font-mono">
                        {s.ipAddress ?? 'unknown IP'}
                      </span>
                      <span className="max-w-xs truncate">
                        {s.userAgent ?? '-'}
                      </span>
                      <span>
                        created {relativeTime(new Date(s.createdAt).getTime())}
                      </span>
                      <span>
                        expires {relativeTime(new Date(s.expiresAt).getTime())}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Danger zone</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <Button
              disabled={pending}
              onClick={handleImpersonate}
              variant="outline"
            >
              <UserCog className="h-4 w-4" />
              Impersonate
            </Button>
            <Button
              disabled={pending}
              onClick={handleDelete}
              variant="destructive"
            >
              <Trash2 className="h-4 w-4" />
              Delete user
            </Button>
          </CardContent>
        </Card>

        <ConfirmDialog {...dialogProps} />
      </div>
    </TooltipProvider>
  );
}
