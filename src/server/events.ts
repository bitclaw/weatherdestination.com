export type DomainEventMap = {
  'subscription.activated': {
    userId: string;
    planId: string | null;
    email: string;
    name: string | undefined;
    amount: number;
    currency: string;
  };
  'purchase.completed': {
    userId: string;
    email: string;
    name: string | undefined;
    amount: number;
    currency: string;
  };
  'account.deleted': { userId: string };
  'credits.purchased': { userId: string; amount: number };
  'admin.auto-promoted': { userId: string; email: string };
  'admin.impersonation.started': {
    adminUserId: string;
    targetUserId: string;
  };
  'billing.refunded': {
    userId: string;
    kind: 'credits' | 'one_time' | 'subscription';
    amount: number;
  };
  'billing.disputed': { userId: string; amount: number };
};

// biome-ignore lint/suspicious/noExplicitAny: internal registry, type safety enforced by on/emit
const handlers = new Map<string, Array<(p: any) => Promise<void>>>();

export const on = <K extends keyof DomainEventMap>(
  event: K,
  handler: (payload: DomainEventMap[K]) => Promise<void>
): void => {
  if (!handlers.has(event)) handlers.set(event, []);
  handlers.get(event)!.push(handler);
};

export const emit = async <K extends keyof DomainEventMap>(
  event: K,
  payload: DomainEventMap[K]
): Promise<void> => {
  for (const handler of handlers.get(event) ?? []) {
    try {
      await handler(payload);
    } catch (err) {
      // Dynamic import: @/lib/logger pulls in pino (node:os) and is outside
      // Vite's import-protection globs. A top-level import + module-scope
      // createLogger() call here is the exact pattern that leaked pino into
      // the client bundle from onboarding.ts.
      const { createLogger } = await import('@/lib/logger');
      createLogger({ module: 'events' }).error(
        { event, err },
        'domain event handler failed'
      );
    }
  }
};

export const _clearHandlers = (): void => {
  handlers.clear();
};
