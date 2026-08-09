import { Link, Outlet } from '@tanstack/react-router';
import { Logo } from '@/components/Logo';
import { config } from '@/config';
import { NoCaptchaProvider, TurnstileProvider } from '@/features/captcha';

export function AuthLayout() {
  const content = <Outlet />;

  const wrapped = config.auth.turnstile.enabled ? (
    <TurnstileProvider siteKey={config.auth.turnstile.siteKey} size="flexible">
      {content}
    </TurnstileProvider>
  ) : (
    <NoCaptchaProvider>{content}</NoCaptchaProvider>
  );

  return (
    <div className="bg-muted/30 relative flex min-h-screen flex-col items-center justify-between px-4 py-6">
      <div className="flex w-full items-center">
        <Link
          className="flex items-center gap-2 text-sm font-semibold text-primary"
          to="/"
        >
          <Logo className="h-4 w-4" />
          {config.appName}
        </Link>
      </div>

      <div className="w-full max-w-sm py-8">{wrapped}</div>

      <div className="flex items-center gap-4">
        <Link
          className="text-muted-foreground hover:text-foreground text-xs transition-colors"
          to="/tos"
        >
          Terms
        </Link>
        <Link
          className="text-muted-foreground hover:text-foreground text-xs transition-colors"
          to="/privacy"
        >
          Privacy Policy
        </Link>
      </div>
    </div>
  );
}
