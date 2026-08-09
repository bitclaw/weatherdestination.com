import { describe, expect, it } from 'bun:test';
import { validateEmailLogic } from './email-validation-logic';

const noop = async () => ({ valid: true });

describe('validateEmailLogic', () => {
  it('passes when both checks disabled', async () => {
    const result = await validateEmailLogic('test@example.com', {
      disposableEmailCheck: false,
      mxCheck: false,
      isDisposableEmail: () => true,
      validateEmailDomain: async () => ({ valid: false, message: 'bad' })
    });
    expect(result.ok).toBe(true);
  });

  it('rejects disposable email when check enabled', async () => {
    const result = await validateEmailLogic('test@mailinator.com', {
      disposableEmailCheck: true,
      mxCheck: false,
      isDisposableEmail: () => true,
      validateEmailDomain: noop
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('EMAIL_DISPOSABLE');
  });

  it('rejects domain with no MX record when mxCheck enabled', async () => {
    const result = await validateEmailLogic('test@invalid-domain.xyz', {
      disposableEmailCheck: false,
      mxCheck: true,
      isDisposableEmail: () => false,
      validateEmailDomain: async () => ({
        valid: false,
        message: 'No MX records found'
      })
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('EMAIL_DOMAIN_INVALID');
  });

  it('passes valid non-disposable email with valid MX', async () => {
    const result = await validateEmailLogic('user@example.com', {
      disposableEmailCheck: true,
      mxCheck: true,
      isDisposableEmail: () => false,
      validateEmailDomain: async () => ({ valid: true })
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.valid).toBe(true);
    }
  });
});
