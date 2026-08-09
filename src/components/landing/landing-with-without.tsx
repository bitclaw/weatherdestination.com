import { Check, X } from 'lucide-react';
import { AnimateIn } from '@/components/ui/animate-in';
import { config } from '@/config';

// TODO: replace with your product's actual pain points and benefits
const withoutItems = [
  'Spend days wiring auth from scratch',
  'Copy-paste Stripe webhook code from docs',
  'Debug concurrent SQLite write errors',
  'Ship week 6 instead of day 1'
];

// TODO: replace with your product's actual benefits
const withItems = [
  'OTP auth ready in 5 minutes',
  'Stripe billing + webhooks pre-wired',
  'Per-user SQLite with write locks built in',
  'Deploy on day 1, build features on day 2'
];

export function LandingWithWithout() {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <AnimateIn className="text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Stop reinventing the wheel
          </h2>
        </AnimateIn>

        <AnimateIn className="mt-12 grid gap-6 md:grid-cols-2" delay={0.1}>
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-8">
            <h3 className="text-destructive mb-4 font-bold text-lg">
              Without {config.appName}
            </h3>
            <ul className="space-y-3">
              {withoutItems.map(item => (
                <li
                  className="text-destructive flex items-start gap-2 text-sm"
                  key={item}
                >
                  <X className="mt-0.5 h-4 w-4 shrink-0 opacity-75" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-8">
            <h3 className="mb-4 font-bold text-lg text-green-700 dark:text-green-400">
              With {config.appName}
            </h3>
            <ul className="space-y-3">
              {withItems.map(item => (
                <li
                  className="flex items-start gap-2 text-sm text-green-700 dark:text-green-400"
                  key={item}
                >
                  <Check className="mt-0.5 h-4 w-4 shrink-0 opacity-75" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </AnimateIn>
      </div>
    </section>
  );
}
