# Problem

A section that articulates the pain point your product solves. Typically placed after the hero.

## Usage

```tsx
import { LandingProblem } from '@/components/landing/landing-problem';

<LandingProblem />
```

## Customizing

Takes no props , the headline, subhead, and three-step sequence (emoji + text) are hardcoded directly in `landing-problem.tsx`. Edit the JSX in place rather than threading props through: this is a marketing section meant to be rewritten per-product, not configured. Keep to 3 steps , the layout (`Step` + `Arrow` components) is built for exactly that count and doesn't reflow gracefully for more or fewer.

## File

`src/components/landing/landing-problem.tsx`
