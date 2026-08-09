# CTA

A call-to-action section, typically placed before the footer to drive signups.

## Usage

```tsx
import { LandingCta } from '@/components/landing/landing-cta';

<LandingCta />
```

## Customizing

Takes no props. Headline/subhead are hardcoded in `landing-cta.tsx`; edit the JSX directly. The primary button switches automatically between "Get access" (linking to `#pricing`) and "Get started free" (linking to `/signup`) based on `config.billing.mode` , one-time vs. subscription billing , so no manual toggling is needed when switching billing modes.

## File

`src/components/landing/landing-cta.tsx`
