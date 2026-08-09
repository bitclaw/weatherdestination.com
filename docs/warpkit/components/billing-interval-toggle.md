# Billing Interval Toggle

Monthly/yearly switch for the pricing section. Typically used alongside the pricing cards to let users compare billing intervals.

## Usage

```tsx
import { BillingIntervalToggle } from '@/components/landing/billing-interval-toggle';

const [interval, setInterval] = useState<'monthly' | 'yearly'>('monthly');

<BillingIntervalToggle value={interval} onChange={setInterval} />
```

## Props

| Prop | Type | Description |
|------|------|-------------|
| `value` | `'monthly' \| 'yearly'` | Current selection |
| `onChange` | `(v: 'monthly' \| 'yearly') => void` | Change handler |

The `<LandingPricing>` component manages this toggle internally. Use `BillingIntervalToggle` directly only if building a custom pricing layout.

## File

`src/components/landing/billing-interval-toggle.tsx`
