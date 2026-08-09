import { CreditCard, Database, Key, Shield, Zap } from 'lucide-react';
import { useState } from 'react';
import { AnimateIn } from '@/components/ui/animate-in';
import { cn } from '@/lib/cn';

// Drop-in replacement for LandingFeatures (the 6-card grid).
// Shows one feature at a time with expanded detail , better for products
// with complex features that benefit from more explanation per item.
//
// To use: in landing-page.tsx, swap:
//   import { LandingFeatures } from './landing-features';
//   <LandingFeatures />
// for:
//   import { LandingFeaturesAccordion } from './landing-features-accordion';
//   <LandingFeaturesAccordion />

const features = [
  {
    icon: Key,
    title: 'Passwordless auth',
    description:
      'OTP and magic-link sign-in via better-auth. Multi-session support, rate limiting, and optional Cloudflare Turnstile captcha included. No passwords to hash or reset flows to build.'
  },
  {
    icon: CreditCard,
    title: 'Stripe billing',
    description:
      'Checkout, customer portal, and webhook handling wired up and ready. Monthly and annual plans from config. One boolean: hasAccess: is all you need to gate features.'
  },
  {
    icon: Database,
    title: 'Per-user SQLite',
    description:
      'Every user gets their own isolated SQLite file via bun:sqlite. No shared schema contention, no row-level security. Writes are serialized with withWriteLock so you never hit SQLITE_BUSY.'
  },
  {
    icon: Zap,
    title: 'TanStack Start',
    description:
      'Full-stack React with file-based routing, type-safe server functions, and TanStack Query for data fetching. SSR out of the box with Nitro. Deploy to Bun, Node, or a serverless platform.'
  },
  {
    icon: Shield,
    title: 'Production security',
    description:
      'CSP, X-Frame-Options, X-Content-Type-Options, and Referrer-Policy headers set globally via Nitro routeRules. Rate limiting on all auth endpoints. Input validation with Zod on every server function.'
  }
];

export function LandingFeaturesAccordion() {
  const [open, setOpen] = useState(0);
  const active = features[open];

  return (
    <section className="px-6 py-24" id="features">
      <div className="mx-auto max-w-6xl">
        <AnimateIn className="text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Everything you need to ship
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-2xl">
            Stop rebuilding the same foundation for every project.
          </p>
        </AnimateIn>

        <AnimateIn className="mt-16 grid gap-8 lg:grid-cols-2" delay={0.1}>
          <ul className="space-y-2">
            {features.map((f, i) => (
              <li key={f.title}>
                <button
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors',
                    open === i
                      ? 'bg-primary/5 border-primary/30'
                      : 'hover:bg-muted/50'
                  )}
                  onClick={() => setOpen(i)}
                  type="button"
                >
                  <div
                    className={cn(
                      'rounded-lg p-2 transition-colors',
                      open === i ? 'bg-primary/10' : 'bg-muted'
                    )}
                  >
                    <f.icon
                      className={cn(
                        'h-4 w-4',
                        open === i ? 'text-primary' : 'text-muted-foreground'
                      )}
                    />
                  </div>
                  <span
                    className={cn(
                      'text-sm font-medium',
                      open === i ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  >
                    {f.title}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="bg-muted/30 flex flex-col justify-center rounded-xl border p-8">
            {active && (
              <>
                <div className="bg-primary/10 inline-flex w-fit rounded-lg p-3">
                  <active.icon className="text-primary h-6 w-6" />
                </div>
                <h3 className="mt-4 text-xl font-semibold">{active.title}</h3>
                <p className="text-muted-foreground mt-3 leading-relaxed">
                  {active.description}
                </p>
              </>
            )}
          </div>
        </AnimateIn>
      </div>
    </section>
  );
}
