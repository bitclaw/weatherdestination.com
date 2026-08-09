import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/toast';
import {
  notificationPreferencesQueryOptions,
  updateNotificationPreferencesFn
} from '@/features/notification-preferences';
import { notificationPreferencesQueryKey } from '@/lib/query-keys';
import { ContentSection } from './content-section';

export function NotificationsPage() {
  const { data } = useSuspenseQuery(notificationPreferencesQueryOptions);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [marketingEmails, setMarketingEmails] = useState(data.marketingEmails);
  const [pending, setPending] = useState(false);

  const handleUpdate = async () => {
    setPending(true);
    try {
      const result = await updateNotificationPreferencesFn({
        data: { marketingEmails }
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: notificationPreferencesQueryKey()
      });
      toast.success('Notification preferences updated');
    } finally {
      setPending(false);
    }
  };

  return (
    <ContentSection
      desc="Configure which emails you want to receive."
      title="Notifications"
    >
      <div className="space-y-8">
        <div className="space-y-3">
          <div className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Marketing emails</p>
              <p className="text-xs text-muted-foreground">
                Onboarding tips, trial reminders, and re-engagement emails.
              </p>
            </div>
            <Switch
              checked={marketingEmails}
              onCheckedChange={setMarketingEmails}
            />
          </div>
          <div className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Security emails</p>
              <p className="text-xs text-muted-foreground">
                Receive emails about your account security. Always on and cannot
                be disabled.
              </p>
            </div>
            <Switch aria-readonly checked disabled />
          </div>
        </div>

        <Button disabled={pending} onClick={handleUpdate} type="button">
          {pending ? 'Updating...' : 'Update notifications'}
        </Button>
      </div>
    </ContentSection>
  );
}
