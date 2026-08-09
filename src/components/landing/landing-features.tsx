import { CreditCard, Database, FileText, Key, Shield, Zap } from 'lucide-react';
import { motion } from 'motion/react';
import { AnimateIn } from '@/components/ui/animate-in';

const features = [
  {
    icon: Key,
    title: 'OTP Auth + Multi-session',
    description:
      'Passwordless login via email OTP. Users stay signed in across devices with multi-session support built in.'
  },
  {
    icon: CreditCard,
    title: 'Stripe billing, done right',
    description:
      'Checkout, customer portal, and webhook handling. One boolean: hasAccess: tells you everything you need.'
  },
  {
    icon: Database,
    title: 'Per-user SQLite',
    description:
      'Every user gets their own isolated SQLite database. No shared schema, no cross-user leaks, no complex row-level security.'
  },
  {
    icon: Zap,
    title: 'TanStack Start',
    description:
      'Full-stack React with server functions, file-based routing, and TanStack Query. The modern way to build.'
  },
  {
    icon: Shield,
    title: 'Drizzle ORM',
    description:
      'Type-safe SQL with Drizzle for the metadata store. No Prisma engine binary. Native bun:sqlite performance.'
  },
  {
    icon: FileText,
    title: 'Blog + MDX',
    description:
      'Content collections with MDX support. Write posts in Markdown, get a fast statically-rendered blog.'
  }
];

export function LandingFeatures() {
  return (
    <section className="bg-muted/30 px-6 py-24" id="features">
      <div className="mx-auto max-w-6xl">
        <AnimateIn className="text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Everything you need to ship
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-2xl">
            Stop rebuilding auth and billing for every project. Start with a
            solid foundation and build the thing only you can build.
          </p>
        </AnimateIn>

        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <AnimateIn delay={i * 0.08} key={feature.title}>
              <motion.div
                className="bg-background group h-full rounded-xl border p-6"
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
              >
                <div className="bg-primary/10 inline-flex rounded-lg p-2">
                  <feature.icon className="text-primary h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold">{feature.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm">
                  {feature.description}
                </p>
              </motion.div>
            </AnimateIn>
          ))}
        </div>
      </div>
    </section>
  );
}
