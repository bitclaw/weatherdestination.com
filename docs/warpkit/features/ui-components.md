# UI Components

Warpkit ships with [shadcn/ui](https://ui.shadcn.com) pre-configured. Components live in `src/components/ui/` and are fully owned by you , no package to update, no API surface to pin.

## How shadcn/ui works

shadcn/ui is a CLI that copies component source into your repo. You own the code. If you need to change a component, edit it directly.

Configuration lives in `components.json` at the root. It tells the CLI where to put files, which path alias to use (`@/`), and which base color the theme is using.

## Adding a component

```bash
bunx shadcn add <component-name>
# example: bunx shadcn add table
```

The component lands in `src/components/ui/`. After adding, export it from `src/components/ui/index.ts` so the rest of the app can import from `@/components/ui`.

## Components included

| Component | File | Notes |
|-----------|------|-------|
| Accordion | `accordion.tsx` | Collapsible sections |
| Badge | `badge.tsx` | Status chips |
| Button | `button.tsx` | Primary, secondary, destructive variants |
| Card | `card.tsx` | Container with header/content/footer slots |
| Checkbox | `checkbox.tsx` | |
| Dialog | `dialog.tsx` | Modal overlay |
| Dropdown Menu | `dropdown-menu.tsx` | Radix-based menu |
| Input | `input.tsx` | Text input |
| Label | `label.tsx` | Accessible form labels |
| Popover | `popover.tsx` | Floating content |
| Progress | `progress.tsx` | |
| Scroll Area | `scroll-area.tsx` | Custom scrollbar |
| Select | `select.tsx` | |
| Separator | `separator.tsx` | |
| Skeleton | `skeleton.tsx` | Loading placeholder |
| Switch | `switch.tsx` | Toggle |
| Tabs | `tabs.tsx` | |
| Toast | `toast.tsx` | Notification system |
| Tooltip | `tooltip.tsx` | |

Custom components also in `src/components/ui/`:

| Component | Notes |
|-----------|-------|
| `animate-in.tsx` | Fade/slide-in wrapper |
| `confetti.tsx` | Celebration effect |
| `confirm-dialog.tsx` | "Are you sure?" dialog |
| `copy-value.tsx` | Copy to clipboard with feedback |
| `error-banner.tsx` | Form/page error display |
| `fieldset.tsx` | Grouped form fields |
| `form-field.tsx` | Label + input + error message |
| `multi-state-badge.tsx` | Badge with status variants |
| `spinner.tsx` | Loading spinner |

## The `cn` utility

All components use `cn()` for conditional class names:

```ts
import { cn } from '@/lib/utils';

<div className={cn('base-class', isActive && 'active-class', className)} />
```

`cn` merges Tailwind classes correctly , later classes override earlier ones, no duplicates.

## Importing components

```ts
import { Button, Card, Input } from '@/components/ui';
```

All components are re-exported from `src/components/ui/index.ts`.

## Dark mode

All shadcn/ui components support dark mode out of the box via CSS variables. The `dark` class is toggled on `<html>` by the theme hook in `src/hooks/use-theme.ts`. No extra configuration needed.

## Related

- [Theming](./theming.md) , swap color palettes with one command
