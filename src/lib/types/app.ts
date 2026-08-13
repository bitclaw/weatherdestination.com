import type { PlanKey } from '@/config';

export type AppUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
};

export type AppRouteContext = {
  queryClient: import('@tanstack/react-query').QueryClient;
  user: AppUser;
  hasAccess: boolean;
  plan: PlanKey;
  isTrialing: boolean;
  trialEndsAt: Date | null;
  isAdmin: boolean;
  onboardingComplete: boolean;
  flags: Record<string, boolean>;
};
