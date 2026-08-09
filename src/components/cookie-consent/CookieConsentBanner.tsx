import 'vanilla-cookieconsent/dist/cookieconsent.css';
import { useEffect } from 'react';
import * as CookieConsent from 'vanilla-cookieconsent';
import { config } from '@/config';
import { useFeatureFlag } from '@/hooks/use-feature-flag';

const umamiId = import.meta.env.VITE_UMAMI_WEBSITE_ID as string | undefined;
const umamiSrc =
  (import.meta.env.VITE_UMAMI_SRC as string | undefined) ??
  'https://cloud.umami.is/script.js';

const UMAMI_SCRIPT_ID = 'umami-analytics-script';

const loadUmami = () => {
  if (!umamiId || document.getElementById(UMAMI_SCRIPT_ID)) return;
  const script = document.createElement('script');
  script.id = UMAMI_SCRIPT_ID;
  script.src = umamiSrc;
  script.defer = true;
  script.setAttribute('data-website-id', umamiId);
  document.head.appendChild(script);
};

const clarityId = import.meta.env.VITE_CLARITY_PROJECT_ID as string | undefined;

const CLARITY_SCRIPT_ID = 'clarity-analytics-script';

type ClarityQueue = {
  (...args: unknown[]): void;
  q?: unknown[];
};

const loadClarity = () => {
  if (!clarityId || document.getElementById(CLARITY_SCRIPT_ID)) return;
  // Clarity's own tag script (fetched from /tag/<id>) calls window.clarity(...)
  // synchronously as soon as it loads, assuming the embedding page already
  // defined window.clarity as a queueing stub - that's what Microsoft's
  // official embed snippet does before inserting the <script> tag. Without
  // it, window.clarity is still undefined when Clarity's code tries to call
  // it, producing `Uncaught TypeError: a[c] is not a function` (a[c] being
  // window["clarity"] in Clarity's minified source) on every page load.
  // Matches Microsoft's documented embed code exactly, just spread across
  // this file's dedup-by-script-id guard instead of an IIFE.
  const w = window as typeof window & { clarity?: ClarityQueue };
  w.clarity =
    w.clarity ??
    ((...args: unknown[]) => {
      (w.clarity as ClarityQueue).q = (w.clarity as ClarityQueue).q ?? [];
      (w.clarity as ClarityQueue).q?.push(args);
    });
  const script = document.createElement('script');
  script.id = CLARITY_SCRIPT_ID;
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${clarityId}`;
  document.head.appendChild(script);
};

const loadAnalytics = () => {
  loadUmami();
  loadClarity();
};

export function CookieConsentBanner() {
  const { enabled } = useFeatureFlag('cookie_consent_enabled');

  useEffect(() => {
    // Consent gating disabled by the admin - preserve the prior unconditional
    // load, this is an explicit opt-out of the consent requirement.
    if (!enabled) {
      loadAnalytics();
      return;
    }
    CookieConsent.run({
      revision: 1,
      cookie: { name: 'cc_cookie', expiresAfterDays: 365 },
      guiOptions: {
        consentModal: { layout: 'box', position: 'bottom right' }
      },
      onConsent: () => {
        if (CookieConsent.acceptedCategory('analytics')) loadAnalytics();
      },
      onChange: () => {
        if (CookieConsent.acceptedCategory('analytics')) loadAnalytics();
      },
      categories: {
        necessary: { enabled: true, readOnly: true },
        analytics: {
          enabled: false,
          autoClear: {
            cookies: [{ name: /^umami\./ }, { name: /^_clck$|^_clsk$|^CLID$/ }],
            reloadPage: true
          }
        }
      },
      language: {
        default: 'en',
        translations: {
          en: {
            consentModal: {
              title: 'We use cookies',
              description:
                `${config.appName} uses cookies to improve your experience. ` +
                'Analytics cookies are optional.',
              acceptAllBtn: 'Accept all',
              acceptNecessaryBtn: 'Reject all',
              showPreferencesBtn: 'Manage preferences',
              footer:
                '<a href="/privacy">Privacy Policy</a> · <a href="/tos">Terms of Service</a>'
            },
            preferencesModal: {
              title: 'Cookie preferences',
              acceptAllBtn: 'Accept all',
              acceptNecessaryBtn: 'Reject all',
              savePreferencesBtn: 'Save preferences',
              sections: [
                {
                  title: 'Strictly necessary',
                  description: 'Required for the site to function.',
                  linkedCategory: 'necessary'
                },
                {
                  title: 'Analytics',
                  description: 'Help us understand how visitors use the site.',
                  linkedCategory: 'analytics'
                }
              ]
            }
          }
        }
      }
    });
  }, [enabled]);

  return null;
}
