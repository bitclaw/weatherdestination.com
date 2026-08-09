import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { getFilterableSidebarItems } from '@/components/layout/sidebar-data';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/toast';
import {
  sidebarPreferencesQueryOptions,
  updateSidebarPreferencesFn
} from '@/features/sidebar-preferences';
import { sidebarPreferencesQueryKey } from '@/lib/query-keys';
import { ContentSection } from './content-section';

const ITEMS = getFilterableSidebarItems();

export function DisplayPage() {
  const { data } = useSuspenseQuery(sidebarPreferencesQueryOptions);
  const queryClient = useQueryClient();
  const toast = useToast();
  const [hidden, setHidden] = useState<Set<string>>(
    () => new Set(data.hiddenUrls)
  );
  const [pending, setPending] = useState(false);

  const toggle = (url: string, visible: boolean) => {
    setHidden(prev => {
      const next = new Set(prev);
      if (visible) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  const handleUpdate = async () => {
    setPending(true);
    try {
      const result = await updateSidebarPreferencesFn({
        data: { hiddenUrls: Array.from(hidden) }
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      await queryClient.invalidateQueries({
        queryKey: sidebarPreferencesQueryKey()
      });
      toast.success('Display preferences updated');
    } finally {
      setPending(false);
    }
  };

  return (
    <ContentSection
      desc="Turn features on or off to customize your dashboard view."
      title="Display"
    >
      <div className="space-y-8">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium">Sidebar</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select the items you want to display in the sidebar.
            </p>
          </div>
          <div className="space-y-2">
            {ITEMS.map(item => (
              <div className="flex items-center gap-3" key={item.url}>
                <Checkbox
                  checked={!hidden.has(item.url)}
                  id={`display-${item.url}`}
                  onCheckedChange={v => toggle(item.url, !!v)}
                />
                <Label className="font-normal" htmlFor={`display-${item.url}`}>
                  {item.title}
                </Label>
              </div>
            ))}
          </div>
        </div>

        <Button disabled={pending} onClick={handleUpdate} type="button">
          {pending ? 'Updating...' : 'Update display'}
        </Button>
      </div>
    </ContentSection>
  );
}
