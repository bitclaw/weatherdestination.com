import { useContext } from 'react';
import { CaptchaContext } from './context';

export function useCaptcha() {
  const ctx = useContext(CaptchaContext);
  if (!ctx) {
    throw new Error('useCaptcha must be used within a CaptchaProvider');
  }
  return ctx;
}
