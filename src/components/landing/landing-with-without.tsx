import { Check, X } from 'lucide-react';
import { AnimateIn } from '@/components/ui/animate-in';
import { config } from '@/config';

const withoutItems = [
  'Guess based on a friend’s recommendation',
  'Find out about wildfire season after signing a lease',
  'Compare cities by opening a dozen browser tabs',
  'Discover the winters are darker than you can handle'
];

const withItems = [
  'Climate and disaster risk scored for every city',
  'Sunshine hours and cloud cover, not just a monthly average',
  'Side-by-side comparison of up to 5 cities at once',
  'Cost of living and air quality in the same view'
];

export function LandingWithWithout() {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <AnimateIn className="text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Stop guessing, start comparing
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

          <div className="rounded-xl border border-success/30 bg-success/5 p-8">
            <h3 className="mb-4 font-bold text-lg text-success">
              With {config.appName}
            </h3>
            <ul className="space-y-3">
              {withItems.map(item => (
                <li
                  className="flex items-start gap-2 text-sm text-success"
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
