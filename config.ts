// =============================================================================
// APP CONFIG: edit this file to rebrand and configure your SaaS
// Theme (colors, radius, fonts): edit src/styles.css :root / .dark vars
//   or run: bun run theme <preset-id>  (browse: https://ui.shadcn.com/create)
// =============================================================================

export type PlanId = 'solo' | 'pro' | 'team';
export type PlanKey = 'free' | 'solo' | 'pro' | 'team';
export type PlanLimits = {
  maxNotes: number;
  maxFileUploads: number;
  maxApiKeys: number;
  maxFeatureRequests: number;
};

export type StripePlan = {
  id: PlanId;
  name: string;
  description: string;
  features: string[];
  popular?: boolean;
  recurring?: {
    priceId: string;
    price: number;
    yearlyPriceId?: string;
    yearlyPrice?: number;
  };
  oneTime?: {
    priceId: string;
    price: number;
  };
};

export type AppConfig = {
  appName: string;
  appDescription: string;
  domainName: string;
  ai: {
    model: string;
    systemPrompt: string;
    localModel: boolean;
  };
  crisp: { id: string };
  resend: {
    fromEmail: string;
    fromName: string;
  };
  theme: {
    // What a first-time visitor sees before they ever set a preference.
    // useTheme() and __root.tsx's SSR inline script both read this - see
    // docs/warpkit/features/dark-mode.md for why the SSR script has to bake this
    // in server-side rather than reading it client-side (avoids a
    // light-then-dark flash on first paint).
    defaultMode: 'light' | 'dark';
    // <meta name="theme-color"> for each mode - the color a mobile browser
    // chrome/status bar shows, not the page background itself.
    lightThemeColor: string;
    darkThemeColor: string;
  };
  seo: {
    defaultTitle: string;
    defaultDescription: string;
    defaultOgImage: string;
    twitterHandle: string;
  };
  billing: {
    mode: 'subscription' | 'one_time';
    trialDays?: number;
    noCardTrial?: boolean;
  };
  stripe: {
    plans: StripePlan[];
    limits: Record<PlanKey, PlanLimits>;
  };
  auth: {
    loginUrl: string;
    callbackUrl: string;
    verificationMethod: 'otp' | 'magic-link' | 'both';
    disposableEmailCheck: boolean;
    mxCheck: boolean;
    socialProviders: {
      google: boolean;
      github: boolean;
    };
    turnstile: {
      enabled: boolean;
      siteKey: string;
    };
  };
  uploads: {
    enabled: boolean;
  };
  credits: {
    enabled: boolean;
    freeCreditsOnSignup: number;
    topUpPriceId: string;
    topUpPrice: number;
    creditsPerTopUp: number;
  };
  legal: {
    companyName: string;
    companyEmail: string;
    effectiveDate: string;
    jurisdiction: string;
  };
};

const domainName = 'weatherdestination.com';

// import.meta.env is Vite-only , undefined in Node/Playwright/Bun script contexts
const _env: Record<string, string | undefined> = import.meta.env ?? {};

// No plans yet: v1 ships the city comparison tool free. Add a plan here
// (and flip billing.mode to 'one_time') once the paid relocation report
// exists to sell - see src/components/landing/landing-pricing.tsx, which
// renders nothing while this stays empty.
const stripePlans: StripePlan[] = [];

export const config = {
  appName: 'WeatherDestination',
  appDescription:
    'Compare cities by climate and Seasonal Affective Disorder risk to find your best destination.',
  domainName,

  ai: {
    model: 'openrouter/auto',
    systemPrompt: 'You are a helpful AI assistant.',
    // Show Chrome built-in LLM toggle when available. Requires Origin Trial token
    // in production (see docs/warpkit/features/ai-chat.md). Set false for cloud-only.
    localModel: true
  },

  crisp: {
    id: _env.VITE_CRISP_WEBSITE_ID ?? ''
  },

  resend: {
    fromEmail: `noreply@${domainName}`,
    fromName: 'WeatherDestination'
  },

  theme: {
    defaultMode: 'light',
    lightThemeColor: '#ffffff',
    darkThemeColor: '#0b1520'
  },

  seo: {
    defaultTitle: 'WeatherDestination: Find your best-fit city by climate',
    defaultDescription:
      'Compare cities by climate and Seasonal Affective Disorder risk to find your best destination.',
    defaultOgImage: '/og-image.png',
    twitterHandle: '@weatherdest'
  },

  billing: {
    mode:
      (_env.VITE_BILLING_MODE as 'subscription' | 'one_time' | undefined) ??
      'subscription',
    // Number('14a') is NaN, not a parse error - a malformed value would
    // otherwise silently disable the trial (NaN > 0 is false) with no
    // indication why. Warn instead of throwing: this file is evaluated in
    // the client bundle too, where a throw would crash the whole app.
    trialDays: (() => {
      if (!_env.VITE_TRIAL_DAYS) return undefined;
      const parsed = Number(_env.VITE_TRIAL_DAYS);
      if (!Number.isFinite(parsed)) {
        console.warn(
          `VITE_TRIAL_DAYS is set to "${_env.VITE_TRIAL_DAYS}", which is not a valid number , trial is disabled. Set it to a positive integer or unset it.`
        );
        return undefined;
      }
      return parsed;
    })(),
    noCardTrial: _env.VITE_TRIAL_NO_CARD === 'true'
  },

  stripe: {
    plans: stripePlans,
    limits: {
      free: {
        maxNotes: 10,
        maxFileUploads: 10,
        maxApiKeys: 3,
        maxFeatureRequests: 20
      },
      solo: {
        maxNotes: 100,
        maxFileUploads: 100,
        maxApiKeys: 10,
        maxFeatureRequests: 100
      },
      pro: {
        maxNotes: -1,
        maxFileUploads: -1,
        maxApiKeys: -1,
        maxFeatureRequests: -1
      },
      team: {
        maxNotes: -1,
        maxFileUploads: -1,
        maxApiKeys: -1,
        maxFeatureRequests: -1
      }
    }
  },

  auth: {
    loginUrl: '/login',
    callbackUrl: '/dashboard',
    verificationMethod:
      (_env.VITE_AUTH_VERIFICATION_METHOD as 'otp' | 'magic-link' | 'both') ??
      'otp',
    disposableEmailCheck: _env.VITE_DISPOSABLE_EMAIL_CHECK !== 'false',
    mxCheck: _env.VITE_MX_CHECK !== 'false',
    socialProviders: {
      google: Boolean(_env.VITE_GOOGLE_CLIENT_ID),
      github: Boolean(_env.VITE_GITHUB_CLIENT_ID)
    },
    turnstile: {
      enabled: Boolean(_env.VITE_TURNSTILE_SITE_KEY),
      siteKey: _env.VITE_TURNSTILE_SITE_KEY ?? ''
    }
  },

  uploads: {
    enabled: Boolean(_env.VITE_S3_FILES_BUCKET)
  },

  credits: {
    enabled: _env.VITE_CREDITS_ENABLED !== 'false',
    freeCreditsOnSignup: 10,
    topUpPriceId: _env.VITE_STRIPE_CREDITS_PRICE_ID ?? '',
    topUpPrice: 5,
    creditsPerTopUp: 100
  },

  legal: {
    companyName: 'Bitclaw LLC',
    companyEmail: 'legal@weatherdestination.com',
    effectiveDate: '2026-08-08',
    jurisdiction: 'United States'
  }
} as const satisfies AppConfig;

// Derived from cookiePrefix in src/server/auth.ts (must stay in sync).
// Import this constant everywhere the session cookie name is needed instead
// of hardcoding the string.
export const SESSION_COOKIE_NAME =
  `${config.appName.toLowerCase()}.session_token` as const;
