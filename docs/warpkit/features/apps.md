# Apps (Integrations)

Static integration card grid at `/dashboard/apps`. Shows third-party services users can connect to.

## What it is

`src/features/apps/` is a static feature: no server functions, no per-user SQLite. It renders a list of integration cards from a hardcoded data file.

**Key files:**
- `src/features/apps/data/` -- integration definitions (name, icon, description, connected status)
- `src/features/apps/pages/index.tsx` -- card grid with filter (connected/all) and A-Z sort
- `src/assets/brand-icons/` -- 17 SVG icon components used by cards

## Customizing integrations

Edit the integrations array in `src/features/apps/data/`. Each entry matches the `App`
type (`name`, `logo`, `connected`, `desc` -- no `tags`/`category` field):

```ts
{
  name: 'Stripe',
  logo: <StripeIcon />,
  connected: true,
  desc: 'Payment processing and billing.'
}
```

Add brand icons to `src/assets/brand-icons/` as React SVG components.

## Pattern note

Apps is a static feature with no `server/` directory. This is intentional: there is no user state to persist, no auth gate needed.
