import {
  AppWindow,
  BarChart3,
  Bell,
  CreditCard,
  Flag,
  Home,
  KeyRound,
  Lightbulb,
  MessageSquare,
  Monitor,
  NotebookPen,
  Palette,
  ScrollText,
  Settings,
  Shield,
  Upload,
  UserCog,
  Users,
  Wrench,
  Zap
} from 'lucide-react';
import type { NavGroup, NavLink } from './types';

// flags defaults to {} (nothing enabled) rather than being required - two
// call sites (command-menu.tsx, getFilterableSidebarItems() below) have no
// route context to read real flags from, and "no flags known" should mean
// "show none of the gated items", the same fail-safe-false posture the
// flags system uses everywhere else.
export const getSidebarData = (
  isAdmin: boolean,
  flags: Record<string, boolean> = {}
): NavGroup[] => [
  {
    title: 'General',
    items: [
      { title: 'Dashboard', url: '/dashboard', icon: Home },
      ...(flags.ai_chat_enabled
        ? [{ title: 'Chat', url: '/dashboard/chat', icon: MessageSquare }]
        : []),
      ...(flags.api_keys_enabled
        ? [{ title: 'API Keys', url: '/dashboard/api-keys', icon: KeyRound }]
        : []),
      ...(flags.feature_requests_enabled
        ? [
            {
              title: 'Feature Requests',
              url: '/dashboard/feature-requests',
              icon: Lightbulb
            }
          ]
        : []),
      { title: 'Audit Log', url: '/dashboard/audit-log', icon: ScrollText },
      { title: 'Apps', url: '/dashboard/apps', icon: AppWindow },
      ...(flags.notes_enabled
        ? [{ title: 'Notes', url: '/dashboard/notes', icon: NotebookPen }]
        : []),
      { title: 'Files', url: '/dashboard/uploads', icon: Upload },
      { title: 'Billing', url: '/dashboard/billing', icon: CreditCard },
      {
        title: 'Settings',
        icon: Settings,
        items: [
          { title: 'Profile', url: '/dashboard/settings', icon: UserCog },
          {
            title: 'Account',
            url: '/dashboard/settings/account',
            icon: Wrench
          },
          {
            title: 'Appearance',
            url: '/dashboard/settings/appearance',
            icon: Palette
          },
          {
            title: 'Notifications',
            url: '/dashboard/settings/notifications',
            icon: Bell
          },
          {
            title: 'Display',
            url: '/dashboard/settings/display',
            icon: Monitor
          },
          ...(flags.credits_enabled
            ? [
                {
                  title: 'Credits',
                  url: '/dashboard/settings/credits',
                  icon: Zap
                }
              ]
            : [])
        ]
      },
      ...(isAdmin
        ? [
            {
              title: 'Admin',
              icon: Shield,
              items: [
                { title: 'Users', url: '/dashboard/admin', icon: Users },
                {
                  title: 'Analytics',
                  url: '/dashboard/admin/analytics',
                  icon: BarChart3
                },
                {
                  title: 'Feature Flags',
                  url: '/dashboard/admin/feature-flags',
                  icon: Flag
                }
              ]
            }
          ]
        : [])
    ]
  }
];

export type FilterableSidebarItem = { title: string; url: string };

// The user-hideable subset of the sidebar: the "General" group's direct links
// only. Settings/Admin are collapsible sub-groups (NavCollapsible, no top-level
// `url`) and are filtered out by construction, not by name - they always stay
// visible. Derived from getSidebarData() rather than a hand-maintained parallel
// list, so it can't drift when a sidebar item is added/removed/renamed.
export const getFilterableSidebarItems = (): FilterableSidebarItem[] =>
  getSidebarData(false)
    .flatMap(group => group.items)
    .filter(
      (item): item is NavLink & { url: string } => typeof item.url === 'string'
    )
    .map(item => ({ title: item.title, url: item.url }));
