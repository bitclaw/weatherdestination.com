import { AnimateIn } from '@/components/ui/animate-in';

// ⚠️  REPLACE BEFORE LAUNCH: these are aspirational placeholder stats.
// Displaying pre-launch is a false claim , update with real numbers
// once you have them, or remove this section entirely until you do.
// Sources: Stripe dashboard, GitHub star count, analytics, user surveys.
const stats = [
  { value: '500+', label: 'developers building with this template' },
  { value: '48h', label: 'from clone to production deployment' },
  { value: '0', label: 'lines of auth / billing boilerplate to write' }
];

export function LandingSocialProof() {
  return (
    <section className="border-y px-6 py-16">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-8 md:grid-cols-3">
          {stats.map((stat, i) => (
            <AnimateIn delay={i * 0.1} key={stat.label}>
              <div className="text-center">
                <p className="text-primary text-5xl font-bold tracking-tight">
                  {stat.value}
                </p>
                <p className="text-muted-foreground mx-auto mt-2 max-w-[200px] text-sm">
                  {stat.label}
                </p>
              </div>
            </AnimateIn>
          ))}
        </div>
      </div>
    </section>
  );
}
