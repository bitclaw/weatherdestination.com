/// <reference types="vite/client" />

type ImportMetaEnv = {
  // Stripe (public price IDs , not secrets)
  // Subscription tiers (add only the vars for plans defined in config.ts)
  readonly VITE_STRIPE_SOLO_PRICE_ID?: string;
  readonly VITE_STRIPE_SOLO_YEARLY_PRICE_ID?: string;
  readonly VITE_STRIPE_PRO_PRICE_ID?: string;
  readonly VITE_STRIPE_PRO_YEARLY_PRICE_ID?: string;
  readonly VITE_STRIPE_TEAM_PRICE_ID?: string;
  readonly VITE_STRIPE_TEAM_YEARLY_PRICE_ID?: string;
  // Free trial (subscription mode only; omit to disable)
  readonly VITE_TRIAL_DAYS?: string;
  // Set to "true" to skip card collection during trial (Stripe payment_method_collection: if_required)
  readonly VITE_TRIAL_NO_CARD?: string;

  // Billing mode
  readonly VITE_BILLING_MODE?: 'subscription' | 'one_time';

  // Auth
  readonly VITE_AUTH_VERIFICATION_METHOD?: 'otp' | 'magic-link' | 'both';

  // Cloudflare Turnstile captcha
  readonly VITE_TURNSTILE_SITE_KEY?: string;

  // Crisp live chat
  readonly VITE_CRISP_WEBSITE_ID?: string;

  // Social OAuth (client-side: show/hide login buttons)
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_GITHUB_CLIENT_ID?: string;

  // File uploads (client-side: enables upload UI when set)
  readonly VITE_S3_FILES_BUCKET?: string;

  // Credits system (optional: defaults to enabled)
  readonly VITE_CREDITS_ENABLED?: string;

  // Credits top-up (required when credits.enabled = true in config.ts)
  readonly VITE_STRIPE_CREDITS_PRICE_ID?: string;

  // Umami analytics
  readonly VITE_UMAMI_WEBSITE_ID?: string;
  readonly VITE_UMAMI_SRC?: string;

  // Microsoft Clarity (session recordings + heatmaps)
  readonly VITE_CLARITY_PROJECT_ID?: string;
};

type ImportMeta = {
  readonly env: ImportMetaEnv;
};
