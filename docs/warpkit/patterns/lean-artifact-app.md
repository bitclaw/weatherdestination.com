# Lean Artifact App

Warpkit ships as a full B2C SaaS demo: notes, AI chat, uploads, feature
requests, an apps grid, a dashboard shell with a sidebar. Not every product
built on Warpkit needs that. If what you're selling is a **digital
artifact**, not ongoing access to an app , a downloadable file, a private
GitHub repo, a Discord invite, a Dropbox folder , most of that dashboard
surface is dead weight: unused compute, unused attack surface, and a
confusing post-purchase experience for a buyer who never needed an account
in the first place.

This page covers stripping Warpkit down to a lean landing + checkout +
fulfillment app, and the one piece of billing plumbing (`/checkout/resume`)
that has to stay regardless of how much you remove.

## The checkout-resume route (don't remove this)

`createOneTimeCheckoutFn`/`createCheckoutSessionFn` require `requireUser()`
, checkout only works for a logged-in user. `CheckoutButton` redirects an
unauthenticated visitor to `/login`, passing a `redirect` search param
pointing at `/checkout/resume?priceId=...&mode=...&interval=...`. That
route (`src/routes/checkout.resume.tsx`) re-fires the same checkout call
once the visitor is authenticated and forwards them to the resulting Stripe
URL.

Without this, a visitor who clicks "Buy" while logged out gets bounced to
login, logs in successfully, and lands on the dashboard having never seen a
Stripe checkout page , the purchase intent is silently dropped. Keep this
route even if you delete everything else described below; it's what makes
"buy while logged out" actually work.

## Fulfillment: the real hookpoint

Delivery of whatever you're selling is a `purchase.completed` domain event
handler, not a new subsystem. See [Domain Events](../features/domain-events.md)
for the event bus itself. The pattern:

```ts
// src/server/event-handlers.ts
on('purchase.completed', async ({ email, name, amount, currency }) => {
  enqueue('email:receipt', { email, name: name ?? null, amount, currency });
});

// A second handler on the same event , add whatever fulfillment fits:
on('purchase.completed', async ({ email }) => {
  enqueue('deliver:download-link', { email });   // or:
  // enqueue('github:invite-buyer', { email });   // private repo access
  // enqueue('discord:invite-buyer', { email });  // Discord invite
  // enqueue('dropbox:share-folder', { email });  // Dropbox share
});
```

Multiple `on()` calls for the same event are independent (see Domain
Events) , keep the receipt-email handler and add a second one for
fulfillment rather than editing the first. Each of those job handlers is
the same shape as any other background job: see [Background Jobs](../features/jobs.md).
There's no pre-built job for every possible delivery channel , writing a
new one is normal, not a gap. It's typically 30-60 lines: call the
provider's API (GitHub invitations, a Discord bot, a signed Dropbox share
link, whatever), handle the "already delivered" case as a no-op rather than
an error (redelivered webhooks are normal, see
[Webhook Replay](./webhook-replay.md)), and let genuine failures retry via
the job queue's normal retry behavior.

## What to remove, and how

Every dashboard feature lives under `src/features/<name>/` as a
self-contained unit (queries, mutations, components, its own barrel). Removing
one is:

1. Delete `src/features/<name>/`
2. Delete its route file(s) under `src/routes/_app.dashboard.<name>*.tsx`
3. Remove its entry from `src/components/layout/sidebar-data.ts`
4. Run `bun run generate` to drop it from the route tree
5. `bun run knip` , catches anything still importing the removed feature

Candidates that make sense to strip for a pure artifact-sale app: `notes`,
`ai-chat`, `uploads`, `feature-requests`, `apps`, `api-keys`,
`sidebar-preferences`, `notification-preferences`, `credits`,
`feature-flags` (if you don't need runtime toggles). Keep `admin` , you
still need somewhere to look up who bought what and handle refunds. Keep
`billing` obviously. `audit-log` and `notifications` are optional; they're
cheap to keep and occasionally useful for debugging a specific buyer's
purchase, but neither is required.

None of this is an all-or-nothing switch. Pull the features you don't need,
leave the rest , the goal is a dashboard that only contains things you'd
actually want a buyer (or yourself, as admin) to see, not a blanket "delete
the dashboard" move.

## What NOT to do

Don't build a config flag that tries to auto-strip the dashboard. Which
features matter is specific to what you're selling , a flag can't make
that call for you, and a half-generic "minimal mode" toggle becomes its own
maintenance burden with more edge cases than just deleting the folders you
don't need. Deleting files is the actual lego-brick operation; a toggle
that tries to simulate it isn't.
