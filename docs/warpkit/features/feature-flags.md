# Feature Flags

Warpkit has two independent flag systems for different use cases:

| System | When to use | Toggleable at runtime? | Persistence |
|--------|-------------|------------------------|-------------|
| Env-var flags (static) | Build-time feature gating (blog, leads) | No — requires restart | `process.env` |
| DB-backed flags (runtime) | Runtime toggles without redeploy (cookie consent, A/B tests) | Yes — via admin UI | Drizzle DB + TTL cache |

---

## 1. Env-var flags (static)

For features that are part of the template but you may want to disable at deployment time (e.g. blog, lead capture). Defined in `src/lib/feature-flags.ts`:

```ts
const FLAGS = {
  blog: () => process.env.FEATURE_BLOG !== 'false',
  leads: () => process.env.FEATURE_LEADS !== 'false'
} as const;
```

Stable features (shipped, tested) default to **on** and require an explicit opt-out via env var.

### Checking a static flag

```ts
import { isEnabled } from '@/lib/feature-flags';
if (!isEnabled('leads')) return { status: 404 };
```

### Adding a static flag

1. Add the flag to `FLAGS` in `src/lib/feature-flags.ts` (type inferred as `keyof typeof FLAGS`)
2. Set the env var in `.env`:

```bash
FEATURE_MY_FEATURE=true
```

---

## 2. DB-backed runtime flags

For features that need runtime toggling without a redeploy (cookie consent gate, staged rollouts, admin-controlled visibility). Managed through the admin panel at `/dashboard/admin/feature-flags`.

### Architecture

```
Admin UI → setFeatureFlagFn → upsertFlag → Drizzle DB → TTLCache invalidation
                                                          ↓
Client   → useFeatureFlag(flag) → getFeatureFlagFn → TTLCache → DB (cache miss)
```

- DB-backed flags are stored in the shared `meta.db` (`feature_flags` table)
- A 30-second `TTLCache` on the server avoids hammering the DB on every page load
- Admin writes automatically invalidate the cache entry for the changed flag

### How to toggle a flag

1. Sign in as an admin user (email in `ADMIN_EMAILS`)
2. Navigate to `/dashboard/admin/feature-flags`
3. Click the toggle for the flag you want to enable/disable

### How to check a flag in a component

```tsx
import { useFeatureFlag } from '@/hooks/use-feature-flag';

function MyComponent() {
  const { enabled } = useFeatureFlag('cookie_consent_enabled');
  if (!enabled) return null;
  return <CookieConsentBanner />;
}
```

`useFeatureFlag` returns `{ enabled: boolean, isLoading: boolean }`. Results are cached client-side for 60 seconds.

### How to check a flag in a server function

```ts
import { getFeatureFlagFn } from '@/features/feature-flags';

const result = await getFeatureFlagFn({ data: { flag: 'my_flag' } });
if (!result.ok || !result.data) return;
```

### Adding a runtime flag

1. Add a default entry in `scripts/seed.ts` under the `FLAGS` array
2. Run `make db.seed` to apply (idempotent — safe to re-run)

```ts
// scripts/seed.ts
const FLAGS: FlagSeed[] = [
  { flag: 'cookie_consent_enabled', enabled: false },
  { flag: 'my_new_flag', enabled: false }
];
```

No migration needed — `upsertFlag` creates the row on first write.

### When to use which system

| Scenario | System |
|----------|--------|
| Toggle built into template, want it off at deploy time | Env-var |
| Feature that needs admin control without redeploy | DB-backed |
| A/B test or staged rollout | DB-backed |
| Build-time dead-code elimination | Env-var |
| Customer-facing toggle switch in settings | DB-backed |
