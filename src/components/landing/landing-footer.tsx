import { Link } from '@tanstack/react-router';
import { Logo } from '@/components/Logo';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { Separator } from '@/components/ui/separator';
import { config } from '@/config';

export function LandingFooter() {
  return (
    <footer className="bg-background border-t">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 text-lg font-bold text-primary">
              <Logo />
              {config.appName}
            </div>
            <p className="text-muted-foreground mt-2 text-sm">
              {config.seo.defaultDescription}
            </p>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold">Product</h3>
            <ul className="text-muted-foreground space-y-2 text-sm">
              <li>
                <Link
                  className="hover:text-primary transition-colors"
                  to="/features"
                >
                  Features
                </Link>
              </li>
              <li>
                <Link
                  className="hover:text-primary transition-colors"
                  to="/pricing"
                >
                  Pricing
                </Link>
              </li>
              <li>
                <a className="hover:text-primary transition-colors" href="#faq">
                  FAQ
                </a>
              </li>
              <li>
                <Link
                  className="hover:text-primary transition-colors"
                  to="/contact"
                >
                  Support
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold">Resources</h3>
            <ul className="text-muted-foreground space-y-2 text-sm">
              <li>
                <Link
                  className="hover:text-primary transition-colors"
                  to="/blog"
                >
                  Blog
                </Link>
              </li>
              <li>
                <Link
                  className="hover:text-primary transition-colors"
                  to="/changelog"
                >
                  Changelog
                </Link>
              </li>
              <li>
                <Link
                  className="hover:text-primary transition-colors"
                  to="/login"
                >
                  Log In
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold">Legal</h3>
            <ul className="text-muted-foreground space-y-2 text-sm">
              <li>
                <Link
                  className="hover:text-primary transition-colors"
                  to="/tos"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  className="hover:text-primary transition-colors"
                  to="/privacy"
                >
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <Separator className="my-8" />
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm" suppressHydrationWarning>
            &copy; {new Date().getFullYear()} {config.appName}. All rights
            reserved.
          </p>
          <ThemeSwitcher />
        </div>
      </div>
    </footer>
  );
}
