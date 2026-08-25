import {
  adminClient,
  emailOTPClient,
  magicLinkClient,
  multiSessionClient,
  twoFactorClient
} from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  plugins: [
    adminClient(),
    emailOTPClient(),
    magicLinkClient(),
    multiSessionClient(),
    // Only bridges the /sign-in/email-otp JSON-response path (the plugin's
    // own onSuccess hook keys off a twoFactorRedirect flag in that
    // response body). The magic-link/OAuth redirect paths never run client
    // JS at verification time - auth.ts's server-side hooks.after redirect
    // override handles those instead, this client hook can't cover them.
    twoFactorClient()
  ]
});
// genericOAuthClient() removed: confirmed absent from better-auth 1.7.1's
// client/plugins exports (the generic-OAuth plugin was rebuilt as a
// first-class social provider in 1.7.0). No signIn.oauth2/oauth2.link
// usage exists anywhere in this app, so nothing depends on it.
