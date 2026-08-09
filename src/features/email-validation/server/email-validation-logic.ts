import { err, ok } from '@bitclaw/result';
import { ERROR_CODES } from '@/lib/constants';

export type ValidateEmailDeps = {
  disposableEmailCheck: boolean;
  mxCheck: boolean;
  isDisposableEmail: (email: string) => boolean;
  validateEmailDomain: (
    email: string,
    options: { checkMx: boolean; dnsTimeout: number }
  ) => Promise<{ valid: boolean; message?: string }>;
};

export async function validateEmailLogic(
  email: string,
  deps: ValidateEmailDeps
) {
  if (deps.disposableEmailCheck && deps.isDisposableEmail(email)) {
    return err(
      ERROR_CODES.EMAIL_DISPOSABLE,
      'Disposable email addresses are not allowed. Please use a permanent email.'
    );
  }

  if (deps.mxCheck) {
    const result = await deps.validateEmailDomain(email, {
      checkMx: true,
      dnsTimeout: 5000
    });
    if (!result.valid) {
      return err(
        ERROR_CODES.EMAIL_DOMAIN_INVALID,
        result.message ??
          'This email domain cannot receive mail. Please use a different email.'
      );
    }
  }

  return ok({ valid: true as const });
}
