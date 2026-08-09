import { Link } from '@tanstack/react-router';
import {
  CreditCard,
  KeyRound,
  NotebookPen,
  Settings,
  Upload
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { config } from '@/config';
import type { AppRouteContext } from '@/lib/types';

type Props = Pick<AppRouteContext, 'user' | 'hasAccess' | 'plan' | 'flags'>;

// `flag` is the gate to check before showing this card - omit it for links
// that should always show (Billing, Settings).
const links = [
  {
    title: 'Notes',
    description: 'Reference CRUD feature , create, edit, pin your notes.',
    to: '/dashboard/notes',
    icon: NotebookPen,
    flag: 'notes_enabled'
  },
  {
    title: 'Billing',
    description: 'Manage your subscription and payment method.',
    to: '/dashboard/billing',
    icon: CreditCard
  },
  {
    title: 'API Keys',
    description: 'Create and manage keys for programmatic access.',
    to: '/dashboard/api-keys',
    icon: KeyRound,
    flag: 'api_keys_enabled'
  },
  {
    title: 'Settings',
    description: 'Profile, appearance, and notification preferences.',
    to: '/dashboard/settings',
    icon: Settings
  }
];

export const DashboardPage = ({ user, hasAccess, plan, flags }: Props) => (
  <>
    <Header fixed>
      <div className="flex-1" />
      <ThemeSwitcher />
    </Header>
    <Main>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back{user.name ? `, ${user.name}` : ''}!
          </h1>
          <p className="mt-1 text-muted-foreground">
            You're on the{' '}
            <span className="font-medium capitalize text-foreground">
              {plan}
            </span>{' '}
            plan
            {hasAccess ? '' : ' (no active subscription)'}.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {links
            .filter(link => !link.flag || flags[link.flag])
            .map(link => {
              const Icon = link.icon;
              return (
                <Link key={link.title} to={link.to}>
                  <Card className="h-full transition-colors hover:bg-muted/50">
                    <CardHeader>
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="mt-2 text-base">
                        {link.title}
                      </CardTitle>
                      <CardDescription>{link.description}</CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              );
            })}
          {config.uploads.enabled && (
            <Link to="/dashboard/uploads">
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardHeader>
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="mt-2 text-base">Uploads</CardTitle>
                  <CardDescription>
                    Upload and manage your files.
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          )}
        </div>
      </div>
    </Main>
  </>
);
