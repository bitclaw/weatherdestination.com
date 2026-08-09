# WithWithout

A two-column comparison showing life before and after your product. Effective for communicating the transformation.

## Usage

```tsx
import { LandingWithWithout } from '@/components/landing/landing-with-without';

<LandingWithWithout />
```

## Customizing

Takes no props. Edit the `withoutItems`/`withItems` string arrays directly in `landing-with-without.tsx` , both are marked `// TODO: replace with your product's actual pain points and benefits` in the source, since the shipped copy describes warpkit itself, not your product. Keep the two lists the same length so the two columns stay visually balanced.

## File

`src/components/landing/landing-with-without.tsx`
