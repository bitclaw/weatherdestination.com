import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex
} from 'drizzle-orm/sqlite-core';
import { PLAN_KEYS } from '@/config';

// ---------------------------------------------------------------------------
// better-auth tables: managed by better-auth, do not rename columns
// ---------------------------------------------------------------------------

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' })
    .notNull()
    .default(false),
  image: text('image'),
  // Set to true by Stripe webhook on successful payment. Gate Pro features on this.
  hasAccess: integer('has_access', { mode: 'boolean' })
    .notNull()
    .default(false),
  // Set to true after user completes or skips the post-signup onboarding wizard.
  onboardingComplete: integer('onboarding_complete', { mode: 'boolean' })
    .notNull()
    .default(false),
  // Set when an account deletion job is created. Blocks app access while deletion is in progress.
  deletionPendingAt: integer('deletion_pending_at', { mode: 'timestamp' }),
  // better-auth admin plugin fields
  role: text('role').default('user'),
  banned: integer('banned', { mode: 'boolean' }),
  banReason: text('ban_reason'),
  banExpires: integer('ban_expires', { mode: 'timestamp' }),
  // better-auth two-factor plugin field
  twoFactorEnabled: integer('two_factor_enabled', { mode: 'boolean' })
    .notNull()
    .default(false),
  // Metered usage credits. Deducted per AI call or other metered operation.
  credits: integer('credits').notNull().default(0),
  // Set after the first re-engagement email is sent. Prevents duplicate sends.
  reengagementSentAt: integer('reengagement_sent_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    token: text('token').notNull().unique(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // better-auth admin plugin field
    impersonatedBy: text('impersonated_by')
  },
  table => [index('sessions_user_id_idx').on(table.userId)]
);

export const accounts = sqliteTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    // better-auth 1.7+ field. Nullable deliberately: SQLite rejects ADD
    // COLUMN ... NOT NULL with no default on a non-empty table, and a
    // deployment migrating from a pre-1.7 install may already have account
    // rows. better-auth's adapter always supplies issuer for every row it
    // writes going forward - null only exists on pre-1.7 rows until a
    // one-time backfill runs (no backfill script ships in this app - no
    // fresh clone of it has pre-1.7 rows to migrate; a deployment
    // upgrading in place should backfill existing rows before relying on
    // the new (issuer, accountId) uniqueness: real OIDC issuer for
    // providers that declare one, e.g. Google's
    // "https://accounts.google.com"; synthetic local:oauth:<providerId>
    // for those that don't, e.g. GitHub/GitLab/Bitbucket - compute these
    // via @better-auth/core's exported createOAuthAccountIssuer()/
    // provider.accountIssuer, do not hand-guess the strings).
    issuer: text('issuer'),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', {
      mode: 'timestamp'
    }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', {
      mode: 'timestamp'
    }),
    scope: text('scope'),
    password: text('password'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
  },
  table => [
    // better-auth 1.7+ resolves account identity by (issuer, accountId), not
    // (providerId, accountId) - SQLite treats NULL as distinct in a unique
    // index, so this coexists safely with pre-backfill null issuer values.
    uniqueIndex('accounts_issuer_account_unique').on(
      table.issuer,
      table.accountId
    ),
    index('accounts_user_id_idx').on(table.userId)
  ]
);

export const verifications = sqliteTable(
  'verifications',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
  },
  table => [index('verifications_identifier_idx').on(table.identifier)]
);

export const twoFactor = sqliteTable(
  'two_factor',
  {
    id: text('id').primaryKey(),
    // Plugin-encrypted at rest by better-auth itself (symmetricEncrypt) -
    // not app-hashed, the Bun.CryptoHasher pattern used elsewhere does not
    // apply here.
    secret: text('secret').notNull(),
    backupCodes: text('backup_codes').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    verified: integer('verified', { mode: 'boolean' }).default(true),
    failedVerificationCount: integer('failed_verification_count').default(0),
    lockedUntil: integer('locked_until', { mode: 'timestamp' })
  },
  table => [index('two_factor_user_id_idx').on(table.userId)]
);

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------

// The complete, real value set Stripe ever sets on Subscription.status
// (node_modules/stripe/cjs/resources/Subscriptions.d.ts, the actual field
// type - not the broader list-filter type elsewhere in the same file that
// also includes 'all'/'ended', which are query params, not real states).
// Exported because multiple other files need to narrow their own local
// `status` types against this same set - billing.rules.server.ts
// previously re-widened it to `string | null` with zero compile-time
// protection against a typo like 'trailing'. `plan` below gets the same
// treatment via config.ts's PLAN_KEYS, for the same reason.
export const SUBSCRIPTION_STATUSES = [
  'active',
  'canceled',
  'incomplete',
  'incomplete_expired',
  'past_due',
  'paused',
  'trialing',
  'unpaid'
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const subscriptions = sqliteTable('subscriptions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  stripePriceId: text('stripe_price_id'),
  plan: text('plan', { enum: PLAN_KEYS }).notNull().default('free'),
  status: text('status', { enum: SUBSCRIPTION_STATUSES })
    .notNull()
    .default('active'),
  currentPeriodEnd: integer('current_period_end', { mode: 'timestamp' }),
  trialEndsAt: integer('trial_ends_at', { mode: 'timestamp' }),
  lastSyncedAt: integer('last_synced_at', { mode: 'timestamp' }),
  // Set once, on customer.subscription.deleted. Never cleared by a later
  // resubscribe - a new subscriptions row's own null cancelledAt is what
  // signals "currently active" for growth-chart purposes; this column only
  // answers "when did the subscription this row represents end."
  cancelledAt: integer('cancelled_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
});

// ---------------------------------------------------------------------------
// Durable operations
// ---------------------------------------------------------------------------

export const accountDeletionJobs = sqliteTable('account_deletion_jobs', {
  id: text('id').primaryKey(),
  // No FK to users.id - this row must survive the user row deletion
  userId: text('user_id').notNull().unique(),

  // Snapshotted at creation - subscription cascade-deletes before job completes
  stripeSubscriptionId: text('stripe_subscription_id'),
  stripeCustomerId: text('stripe_customer_id'),

  // Step completion timestamps (null = not done, non-null = done)
  stripeCancelledAt: integer('stripe_cancelled_at', { mode: 'timestamp' }),
  stripeDeletedAt: integer('stripe_deleted_at', { mode: 'timestamp' }),
  // Must run (and be recorded) before userDbDeletedAt - S3 keys live in the
  // per-user DB that step deletes.
  filesDeletedAt: integer('files_deleted_at', { mode: 'timestamp' }),
  userDbDeletedAt: integer('user_db_deleted_at', { mode: 'timestamp' }),
  sharedUserDeletedAt: integer('shared_user_deleted_at', { mode: 'timestamp' }),

  // Terminal state (no failedAt - incomplete jobs are always retried)
  completedAt: integer('completed_at', { mode: 'timestamp' }),

  // Retry tracking
  attemptCount: integer('attempt_count').notNull().default(0),
  lastAttemptAt: integer('last_attempt_at', { mode: 'timestamp' }),
  lastError: text('last_error'),

  // Concurrency lease - prevents two workers running the same job simultaneously
  leaseExpiresAt: integer('lease_expires_at', { mode: 'timestamp' }),

  initiatedBy: text('initiated_by', { enum: ['user', 'admin'] }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date())
});

// Records that an email has already used its free trial, so a delete +
// re-signup with the same address doesn't grant a second one. Written in
// the same sync transaction as the user-row delete (account-deletion.server.ts
// step 5, "POINT OF NO RETURN") - like accountDeletionJobs, no FK to
// users.id: this row must outlive the user row it originated from.
export const trialAbuseMarkers = sqliteTable('trial_abuse_markers', {
  id: text('id').primaryKey(),
  hashedEmail: text('hashed_email').notNull().unique(),
  deletedAt: integer('deleted_at', { mode: 'timestamp' }).notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date())
});

// ---------------------------------------------------------------------------
// One-time purchases
// ---------------------------------------------------------------------------

export const purchases = sqliteTable(
  'purchases',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    stripePaymentIntentId: text('stripe_payment_intent_id').unique().notNull(),
    stripeCustomerId: text('stripe_customer_id'),
    stripePriceId: text('stripe_price_id').notNull(),
    amount: integer('amount').notNull(),
    currency: text('currency').notNull().default('usd'),
    // Set only for credits top-up purchases, so a refund can claw back the
    // exact number of credits this purchase granted.
    creditsGranted: integer('credits_granted'),
    // Dedup marker for charge.refunded processing , same role
    // stripePaymentIntentId plays for the original grant.
    refundedAt: integer('refunded_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
  },
  table => [index('purchases_user_id_idx').on(table.userId)]
);

// ---------------------------------------------------------------------------
// Recurring payments (invoice.paid) - distinct from `purchases`, which only
// covers one-time and credits-top-up checkouts, never subscription renewals.
// ---------------------------------------------------------------------------

export const payments = sqliteTable(
  'payments',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    stripeInvoiceId: text('stripe_invoice_id').unique().notNull(),
    stripeCustomerId: text('stripe_customer_id'),
    plan: text('plan', { enum: PLAN_KEYS }).notNull(),
    amount: integer('amount').notNull(),
    currency: text('currency').notNull().default('usd'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
  },
  table => [index('payments_user_id_idx').on(table.userId)]
);

// ---------------------------------------------------------------------------
// MRR snapshots - populated monthly by the analytics:snapshot-mrr cron job.
// Historical months before this feature shipped have no snapshot and are
// not backfilled: the MRR trend chart only shows real months forward from
// whenever this table starts getting rows.
// ---------------------------------------------------------------------------

export const mrrSnapshots = sqliteTable('mrr_snapshots', {
  id: text('id').primaryKey(),
  // 'YYYY-MM', one row per calendar month
  month: text('month').notNull().unique(),
  mrr: integer('mrr').notNull(),
  activeSubscribers: integer('active_subscribers').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

// ---------------------------------------------------------------------------
// Feature flags
// ---------------------------------------------------------------------------

export const featureFlags = sqliteTable('feature_flags', {
  id: text('id').primaryKey(),
  flag: text('flag').notNull().unique(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
});

// ---------------------------------------------------------------------------
// Lead capture
// ---------------------------------------------------------------------------

export const leads = sqliteTable('leads', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

// ---------------------------------------------------------------------------
// Cities (reference data - same 82 seeded US cities for every visitor, not
// user-scoped, so it lives here rather than in a per-user DB. Ported from
// the pre-rewrite site's prisma/seed-cities.ts data.)
// ---------------------------------------------------------------------------

export const cities = sqliteTable(
  'cities',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    state: text('state').notNull(),
    stateCode: text('state_code').notNull(),
    latitude: real('latitude').notNull(),
    longitude: real('longitude').notNull(),
    population: integer('population'),
    // Climate risk scores, 0-100, higher = more risk. Placeholder values
    // ported from the old site pending real NOAA-derived scoring.
    wildfireRisk: integer('wildfire_risk').notNull(),
    floodRisk: integer('flood_risk').notNull(),
    hurricaneRisk: integer('hurricane_risk').notNull(),
    heatWaveRisk: integer('heat_wave_risk').notNull(),
    droughtRisk: integer('drought_risk').notNull(),
    // Weather / SAD data, refreshed from NOAA via the file cache in data/weather/
    avgSunshineHours: real('avg_sunshine_hours').notNull(),
    avgCloudCover: real('avg_cloud_cover').notNull(),
    avgTempHigh: real('avg_temp_high').notNull(),
    avgTempLow: real('avg_temp_low').notNull(),
    costOfLivingIndex: real('cost_of_living_index'),
    airQualityIndex: integer('air_quality_index'),
    dataLastUpdated: integer('data_last_updated', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
  },
  table => [
    uniqueIndex('cities_name_state_code_idx').on(table.name, table.stateCode),
    index('cities_wildfire_risk_idx').on(table.wildfireRisk),
    index('cities_flood_risk_idx').on(table.floodRisk)
  ]
);

// ---------------------------------------------------------------------------
// Feature requests (shared board - moved from per-user SQLite so votes can
// be shared across users; see docs/warpkit/features/feature-requests.md)
// ---------------------------------------------------------------------------

export const featureRequests = sqliteTable('feature_requests', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default('submitted'),
  priority: text('priority').notNull().default('medium'),
  category: text('category').notNull().default('other'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
});

export const featureRequestVotes = sqliteTable(
  'feature_request_votes',
  {
    id: text('id').primaryKey(),
    featureRequestId: text('feature_request_id')
      .notNull()
      .references(() => featureRequests.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
  },
  table => [
    // DB-level "one vote per user per request" invariant, not just app logic
    uniqueIndex('feature_request_votes_unique').on(
      table.featureRequestId,
      table.userId
    )
  ]
);

// ---------------------------------------------------------------------------
// Admin audit log , written from a better-auth hooks.after matcher on
// /admin/impersonate-user (src/server/auth.ts), not from the app's own
// adminImpersonateUserFn. That function is only a rate-limited self-target
// pre-check the client can skip by calling authClient.admin.impersonateUser
// directly, so it can't be the audit trail for the highest-privilege action
// in the app , the hook fires unconditionally whenever better-auth's own
// endpoint actually creates an impersonation session, regardless of what the
// client called first. See docs/warpkit/features/admin.md.
// ---------------------------------------------------------------------------

export const adminAuditLog = sqliteTable(
  'admin_audit_log',
  {
    id: text('id').primaryKey(),
    type: text('type').notNull(),
    adminUserId: text('admin_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    targetUserId: text('target_user_id').references(() => users.id, {
      onDelete: 'set null'
    }),
    payload: text('payload'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
  },
  table => [index('admin_audit_log_admin_idx').on(table.adminUserId)]
);

// ---------------------------------------------------------------------------
// Shared/cross-process rate limiting (IP-keyed, pre-auth endpoints). Backed
// by the shared meta DB, unlike createRateLimiter's in-memory Map, which
// only tracks state within a single cluster.ts worker process.
// ---------------------------------------------------------------------------

export const rateLimitEvents = sqliteTable(
  'rate_limit_events',
  {
    id: text('id').primaryKey(),
    key: text('key').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
  },
  table => [
    index('rate_limit_events_key_created_idx').on(table.key, table.createdAt)
  ]
);
