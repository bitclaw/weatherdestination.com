import { Link } from '@tanstack/react-router';
import { motion } from 'motion/react';

type LandingMobileNavProps = {
  onClose: () => void;
};

// No exit animation: the parent (landing-navbar.tsx) unmounts this
// component immediately when closed rather than keeping it mounted for
// AnimatePresence to orchestrate an exit - that's what lets the
// motion/react import stay deferred until the user actually taps the
// mobile toggle. Only the opening transition plays.
export function LandingMobileNav({ onClose }: LandingMobileNavProps) {
  return (
    <motion.div
      animate={{ height: 'auto', opacity: 1 }}
      className="bg-background overflow-hidden border-b md:hidden"
      initial={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
    >
      <div className="flex flex-col gap-4 px-6 pt-2 pb-4 text-sm">
        <Link
          className="text-muted-foreground hover:text-primary"
          onClick={onClose}
          to="/features"
        >
          Features
        </Link>
        <Link
          className="text-muted-foreground hover:text-primary"
          onClick={onClose}
          to="/pricing"
        >
          Pricing
        </Link>
        <Link
          className="text-muted-foreground hover:text-primary"
          onClick={onClose}
          to="/blog"
        >
          Blog
        </Link>
        <Link
          className="border-input bg-background hover:bg-muted text-foreground rounded-md border px-3 py-1.5 text-center text-sm font-medium transition-colors"
          onClick={onClose}
          to="/login"
        >
          Log in
        </Link>
        <Link
          className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-3 py-1.5 text-center text-sm font-medium transition-colors"
          onClick={onClose}
          to="/signup"
        >
          Sign Up
        </Link>
      </div>
    </motion.div>
  );
}
