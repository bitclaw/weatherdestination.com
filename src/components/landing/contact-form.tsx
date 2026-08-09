import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { config } from '@/config';
import {
  NoCaptchaProvider,
  TurnstileProvider,
  useCaptcha
} from '@/features/captcha';
import { cn } from '@/lib/cn';

type ContactFormProps = {
  className?: string;
};

export function ContactForm(props: ContactFormProps) {
  return config.auth.turnstile.enabled ? (
    <TurnstileProvider siteKey={config.auth.turnstile.siteKey}>
      <ContactFormInner {...props} />
    </TurnstileProvider>
  ) : (
    <NoCaptchaProvider>
      <ContactFormInner {...props} />
    </NoCaptchaProvider>
  );
}

function ContactFormInner({ className }: ContactFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
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
      const res = await fetch('/api/v1/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          message,
          turnstileToken: captchaToken
        })
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
        Thanks for reaching out! We'll get back to you soon.
      </p>
    );
  }

  return (
    <form
      className={cn('flex flex-col gap-3', className)}
      onSubmit={handleSubmit}
    >
      <input
        className="border-input bg-background placeholder:text-muted-foreground focus:ring-ring rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
        disabled={status === 'loading'}
        onChange={e => setName(e.target.value)}
        placeholder="Your name"
        required
        type="text"
        value={name}
      />
      <input
        className="border-input bg-background placeholder:text-muted-foreground focus:ring-ring rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
        disabled={status === 'loading'}
        onChange={e => setEmail(e.target.value)}
        placeholder="you@example.com"
        required
        type="email"
        value={email}
      />
      <textarea
        className="border-input bg-background placeholder:text-muted-foreground focus:ring-ring min-h-32 rounded-lg border px-3 py-2 text-sm focus:ring-2 focus:outline-none"
        disabled={status === 'loading'}
        onChange={e => setMessage(e.target.value)}
        placeholder="How can we help?"
        required
        value={message}
      />
      {config.auth.turnstile.enabled && <div ref={captchaRef} />}
      <button
        className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors disabled:opacity-50"
        disabled={
          status === 'loading' ||
          !name ||
          !email ||
          !message ||
          (config.auth.turnstile.enabled && !captchaToken)
        }
        type="submit"
      >
        {status === 'loading' && <Loader2 className="h-4 w-4 animate-spin" />}
        Send message
      </button>
      {status === 'error' && (
        <p className="text-destructive text-xs">{errorMsg}</p>
      )}
    </form>
  );
}
