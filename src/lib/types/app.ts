import type { PlanId } from '@/config';

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
  plan: 'free' | PlanId;
  isTrialing: boolean;
  trialEndsAt: Date | null;
  isAdmin: boolean;
  onboardingComplete: boolean;
};
