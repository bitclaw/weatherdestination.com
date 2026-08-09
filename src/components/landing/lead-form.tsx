import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { config } from '@/config';
import {
  NoCaptchaProvider,
  TurnstileProvider,
  useCaptcha
} from '@/features/captcha';
import { cn } from '@/lib/cn';

type LeadFormProps = {
  className?: string;
  placeholder?: string;
  buttonText?: string;
};

export function LeadForm(props: LeadFormProps) {
  return config.auth.turnstile.enabled ? (
    <TurnstileProvider siteKey={config.auth.turnstile.siteKey}>
      <LeadFormInner {...props} />
    </TurnstileProvider>
  ) : (
    <NoCaptchaProvider>
      <LeadFormInner {...props} />
    </NoCaptchaProvider>
  );
}

function LeadFormInner({
  className,
  placeholder = 'you@example.com',
  buttonText = 'Join the waitlist'
}: LeadFormProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const {
    token: captchaToken,
    containerRef: captchaRef,
    reset: resetCaptcha
  } = useCaptcha();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    try {
      const res = await fetch('/api/v1/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, turnstileToken: captchaToken })
      });
      // Turnstile tokens are single-use: reset regardless of outcome so the
      // next submit gets a fresh one.
      resetCaptcha();
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErrorMsg(
          (body as { error?: string }).error ?? 'Something went wrong'
        );
        setStatus('error');
        return;
      }
      setStatus('success');
    } catch {
      resetCaptcha();
      setErrorMsg('Network error. Please try again.');
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <p className={cn('text-muted-foreground text-sm', className)}>
        You're on the list! We'll be in touch soon.
      </p>
    );
  }

  return (
    <form
      className={cn('flex flex-col gap-2 sm:flex-row', className)}
      onSubmit={handleSubmit}
    >
      <input
        className="border-input bg-background placeholder:text-muted-foreground focus:ring-ring flex-1 rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
        disabled={status === 'loading'}
        onChange={e => setEmail(e.target.value)}
        placeholder={placeholder}
        required
        type="email"
        value={email}
      />
      <button
        className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors disabled:opacity-50"
        disabled={
          status === 'loading' ||
          !email ||
          (config.auth.turnstile.enabled && !captchaToken)
        }
        type="submit"
      >
        {status === 'loading' && <Loader2 className="h-4 w-4 animate-spin" />}
        {buttonText}
      </button>
      {status === 'error' && (
        <p className="text-destructive text-xs sm:col-span-2">{errorMsg}</p>
      )}
      {config.auth.turnstile.enabled && <div ref={captchaRef} />}
    </form>
  );
}
