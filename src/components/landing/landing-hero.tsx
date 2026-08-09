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

const techStack = ['Bun', 'TanStack Start', 'shadcn/ui', 'Stripe', 'SQLite'];

// ⚠️ REPLACE: swap with real user avatars before launch.
// Add an `img` field to each entry for real photos; initials + color is the fallback.
const SOCIAL_AVATARS = [
  { initials: 'MK', color: '#3b82f6' },
  { initials: 'SR', color: '#8b5cf6' },
  { initials: 'TJ', color: '#10b981' },
  { initials: 'AN', color: '#f59e0b' },
  { initials: 'LP', color: '#ef4444' }
];

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
            Auth · Billing · Per-user SQLite: ship features, not infrastructure
          </span>
        </motion.div>

        <h1 className="text-5xl font-bold tracking-tight md:text-6xl lg:text-7xl">
          Your SaaS,{' '}
          <span className="from-primary to-primary/60 bg-gradient-to-r bg-clip-text text-transparent">
            production-ready
          </span>{' '}
          from day one
        </h1>

        <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-xl">
          {config.appName} gives you OTP auth, Stripe billing, and a per-user
          SQLite database so you can focus on building your product: not the
          plumbing.
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

        {/* Pre-launch waitlist: swap the CTA above for this LeadForm when you
            haven't launched yet. Requires FEATURE_LEADS=true in your .env.
            The /api/v1/lead endpoint saves the email and sends a confirmation. */}
        {/* <motion.div className="mt-10 w-full max-w-sm mx-auto" variants={item}>
          <LeadForm buttonText="Join the waitlist" />
        </motion.div> */}

        <motion.div
          className="mt-8 flex items-center justify-center gap-3"
          variants={item}
        >
          <div className="flex -space-x-2">
            {SOCIAL_AVATARS.map(avatar => (
              <div
                className="ring-background flex h-8 w-8 items-center justify-center rounded-full ring-2 text-xs font-semibold text-white"
                key={avatar.initials}
                style={{ backgroundColor: avatar.color }}
              >
                {avatar.initials}
              </div>
            ))}
          </div>
          <p className="text-muted-foreground text-sm">
            Join <span className="text-foreground font-semibold">500+</span>{' '}
            founders already shipping
          </p>
        </motion.div>

        <motion.div
          className="mt-6 flex flex-wrap items-center justify-center gap-2"
          variants={item}
        >
          <span className="text-muted-foreground mr-1 text-xs">Built with</span>
          {techStack.map(tech => (
            <span
              className="text-muted-foreground bg-muted/60 rounded-full px-3 py-1 text-xs font-medium"
              key={tech}
            >
              {tech}
            </span>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}
