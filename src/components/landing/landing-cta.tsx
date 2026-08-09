import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import { AnimateIn } from '@/components/ui/animate-in';
import { config } from '@/config';

export function LandingCta() {
  const isOneTime = config.billing.mode === 'one_time';

  return (
    <section className="px-6 py-24">
      <AnimateIn>
        <div className="relative mx-auto max-w-3xl overflow-hidden rounded-2xl p-12 text-center">
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10"
            style={{
              background:
                'linear-gradient(135deg, var(--color-primary) 0%, color-mix(in oklch, var(--color-primary) 70%, transparent) 100%)'
            }}
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 opacity-10"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
              backgroundSize: '24px 24px'
            }}
          />

          <h2 className="text-primary-foreground text-3xl font-bold tracking-tight md:text-4xl">
            Ready to ship your SaaS?
          </h2>
          <p className="text-primary-foreground/80 mx-auto mt-4 max-w-xl text-lg">
            Stop rebuilding the same foundation. Clone {config.appName},
            customize the config, and launch in days: not weeks.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            {isOneTime ? (
              <a
                className="bg-background text-foreground hover:bg-background/90 inline-flex items-center gap-2 rounded-lg px-6 py-3 font-semibold transition-colors"
                href="#pricing"
              >
                Get access
                <ArrowRight className="h-4 w-4" />
              </a>
            ) : (
              <Link
                className="bg-background text-foreground hover:bg-background/90 inline-flex items-center gap-2 rounded-lg px-6 py-3 font-semibold transition-colors"
                to="/signup"
              >
                Get started free
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
            <a
              className="text-primary-foreground/90 hover:text-primary-foreground inline-flex items-center gap-1 text-sm font-medium underline-offset-4 transition-colors hover:underline"
              href="#pricing"
            >
              View pricing →
            </a>
          </div>
        </div>
      </AnimateIn>
    </section>
  );
}
