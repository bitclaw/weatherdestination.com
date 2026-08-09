import { useEffect } from 'react';
import { config } from '@/config';

export function CrispChat() {
  useEffect(() => {
    if (config.crisp.id) {
      import('crisp-sdk-web').then(({ Crisp }) => {
        Crisp.configure(config.crisp.id);
      });
    }
  }, []);
  return null;
}
