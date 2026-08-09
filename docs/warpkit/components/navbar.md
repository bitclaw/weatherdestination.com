# Navbar

The landing page navigation bar. Renders the app name, nav links, and a login/dashboard button.

## Usage

```tsx
import { LandingNavbar } from '@/components/landing';

<LandingNavbar />
```

## What it renders

- App name (from `config.appName`) on the left
- Navigation links in the center
- Login button (redirects to `/login`) or Dashboard button if already authenticated, on the right

## File

`src/components/landing/landing-navbar.tsx`
