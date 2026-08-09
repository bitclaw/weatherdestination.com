import { Link } from '@tanstack/react-router';
import { Menu, X } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { config } from '@/config';
import { cn } from '@/lib/cn';

// Lazy: pulls in motion/react, otherwise shipped in the above-the-fold
// navbar bundle on every load even though it's only needed after a mobile
// user taps the toggle. Gated behind {mobileOpen && ...} below (not always
// mounted) so the import genuinely only fires on interaction - the tradeoff
// is the close (exit) animation no longer plays, since the component
// unmounts immediately when mobileOpen flips false rather than staying
// mounted for AnimatePresence to orchestrate the exit. Opening still
// animates in normally once the chunk resolves.
const LandingMobileNav = lazy(() =>
  import('./landing-mobile-nav').then(m => ({ default: m.LandingMobileNav }))
);

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav
      className={cn(
        'fixed top-0 right-0 left-0 z-50 transition-all duration-300',
        scrolled
          ? 'bg-background/80 border-b backdrop-blur-lg'
          : 'bg-transparent'
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          className="flex items-center gap-2 text-lg font-bold text-primary"
          to="/"
        >
          <Logo className="h-5 w-5" />
          {config.appName}
        </Link>

        <div className="hidden items-center gap-6 text-sm md:flex">
          <Link
            className="text-muted-foreground hover:text-primary"
            to="/features"
          >
            Features
          </Link>
          <Link
            className="text-muted-foreground hover:text-primary"
            to="/compare"
          >
            Compare
          </Link>
          <Link
            className="text-muted-foreground hover:text-primary"
            to="/pricing"
          >
            Pricing
          </Link>
          <Link className="text-muted-foreground hover:text-primary" to="/blog">
            Blog
          </Link>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            className="border-input bg-background hover:bg-muted text-foreground rounded-md border px-3 py-1.5 text-sm font-medium transition-colors"
            to="/login"
          >
            Log in
          </Link>
          <Link
            className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
            to="/signup"
          >
            Sign Up
          </Link>
        </div>

        <Button
          aria-label="Toggle menu"
          className="text-muted-foreground hover:text-primary h-auto p-1 md:hidden"
          onClick={() => setMobileOpen(!mobileOpen)}
          size="icon"
          type="button"
          variant="ghost"
        >
          {mobileOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </Button>
      </div>

      {mobileOpen && (
        <Suspense fallback={null}>
          <LandingMobileNav onClose={() => setMobileOpen(false)} />
        </Suspense>
      )}
    </nav>
  );
}
