type WithStatus = { status: string | null } | null;

export const isSubscriptionActive = (sub: WithStatus): boolean =>
  sub?.status === 'active' || sub?.status === 'trialing';
