import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { ErrorBanner } from '@/components/ui/error-banner';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/auth-client';
import type { AppUser } from '@/lib/types';
import { ContentSection } from './content-section';

type Props = { user: AppUser };

export function ProfilePage({ user }: Props) {
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const form = useForm({
    defaultValues: { name: user.name ?? '' },
    onSubmit: async ({ value }) => {
      setSaveError(null);
      setSaveSuccess(false);
      const { error } = await authClient.updateUser({ name: value.name });
      if (error) {
        setSaveError(error.message ?? 'Failed to update profile');
        return;
      }
      setSaveSuccess(true);
    }
  });

  return (
    <ContentSection
      desc="This is how others will see you on the site."
      title="Profile"
    >
      <form
        className="space-y-8"
        onSubmit={e => {
          e.preventDefault();
          form.handleSubmit();
        }}
      >
        {saveSuccess && (
          <div className="rounded-md border border-success/30 bg-success/10 p-3 text-sm text-success">
            Profile updated.
          </div>
        )}
        <ErrorBanner message={saveError} variant="error" />

        <FormField htmlFor="email" label="Email">
          <Input
            className="opacity-70"
            disabled
            id="email"
            type="email"
            value={user.email}
          />
        </FormField>

        <form.Field name="name" validators={{ onChange: z.string().max(100) }}>
          {field => (
            <FormField
              error={field.state.meta.errors[0]?.toString()}
              htmlFor="name"
              label="Display name"
            >
              <Input
                id="name"
                onBlur={field.handleBlur}
                onChange={e => field.handleChange(e.target.value)}
                placeholder="Your name"
                type="text"
                value={field.state.value}
              />
            </FormField>
          )}
        </form.Field>

        <form.Subscribe selector={s => s.isSubmitting}>
          {isSubmitting => (
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Saving...' : 'Update profile'}
            </Button>
          )}
        </form.Subscribe>
      </form>
    </ContentSection>
  );
}
