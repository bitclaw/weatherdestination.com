import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { config } from '@/config';

// import { LeadForm } from './lead-form'; // uncomment for pre-launch waitlist mode

const ease = [0.21, 0.47, 0.32, 0.98] as const;

const container = {
  initial: {},
  animate: { transition: { staggerChildren: 0.1 } }
};

const item = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease } }
};

export function LandingHero() {
  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pt-16 text-center">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% -10%, color-mix(in oklch, var(--color-primary) 15%, transparent) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 80% 60%, color-mix(in oklch, var(--color-primary) 8%, transparent) 0%, transparent 60%)'
        }}
      />

      <motion.div
        animate="animate"
        className="mx-auto max-w-3xl"
        initial="initial"
        variants={container}
      >
        <motion.div
          className="mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm"
          variants={item}
        >
          <motion.span
            animate={{ scale: [1, 1.4, 1] }}
            className="bg-primary h-1.5 w-1.5 rounded-full"
            transition={{
              duration: 2,
              repeat: Number.POSITIVE_INFINITY,
              ease: 'easeInOut'
            }}
          />
          <span className="text-muted-foreground">
            Free · NOAA climate data · 82 US cities
          </span>
        </motion.div>

        <h1 className="text-5xl font-bold tracking-tight md:text-6xl lg:text-7xl">
          Find where the{' '}
          <span className="from-primary to-primary/60 bg-gradient-to-r bg-clip-text text-transparent">
            weather
          </span>{' '}
          actually fits you
        </h1>

        <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-xl">
          {config.appName} compares wildfire, flood, hurricane, and heat risk
          alongside sunshine, air quality, and cost of living: so you can pick a
          destination with real data, not a hunch.
        </p>

        <motion.div
          className="mt-10 flex flex-wrap items-center justify-center gap-4"
          variants={item}
        >
          <Link
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 rounded-lg px-6 py-3 font-semibold transition-colors"
            to="/compare"
          >
            Compare cities
            <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            className="text-muted-foreground hover:text-foreground rounded-lg border px-6 py-3 font-semibold transition-colors"
            href="#features"
          >
            See what's included
          </a>
        </motion.div>
      </motion.div>
    </section>
  );
}
