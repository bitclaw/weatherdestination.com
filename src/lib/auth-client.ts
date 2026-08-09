import {
  adminClient,
  emailOTPClient,
  genericOAuthClient,
  magicLinkClient,
  multiSessionClient
} from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  plugins: [
    adminClient(),
    emailOTPClient(),
    genericOAuthClient(),
    magicLinkClient(),
    multiSessionClient()
  ]
});
