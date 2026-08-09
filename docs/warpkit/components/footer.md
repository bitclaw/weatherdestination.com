# Footer

Landing page footer with links, legal pages, and app branding.

## Usage

```tsx
import { LandingFooter } from '@/components/landing';

<LandingFooter />
```

## What it renders

- App name (from `config.appName`)
- Links to `/privacy` and `/tos`
- Copyright with company name (from `config.legal.companyName`)

## Files

`src/components/landing/landing-footer.tsx`

Legal page content is in `src/routes/_landing.privacy.tsx` and `src/routes/_landing.tos.tsx`. Update `config.legal` in `config.ts` to set company details.
