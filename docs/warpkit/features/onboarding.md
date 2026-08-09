# Onboarding Wizard

Multi-step onboarding flow shown to new users after signup. Located at `/onboarding`.

## How it works

The wizard uses `useState<1 | 2>(1)` to track the current step. Each step component receives `onComplete` (advance to next step) and optionally `onSkip` (advance without completing setup).

```tsx
function OnboardingPage() {
  const [step, setStep] = useState<1 | 2>(1);

  return (
    <>
      {step === 1 && <WelcomeStep onComplete={() => setStep(2)} />}
      {step === 2 && <ProfileStep onComplete={() => router.navigate({ to: '/dashboard' })} />}
    </>
  );
}
```

## Adding a step

1. Widen the type: `useState<1 | 2 | 3>(1)`
2. Add a render case: `{step === 2 && <YourStep onComplete={() => setStep(3)} />}`
3. Prefetch data in the route loader if the step needs it:
   ```ts
   loader: async ({ context }) => {
     await ctx.queryClient.ensureQueryData(myQueryOptions);
   }
   ```

Prefetched data means step components can use `useQuery` without a `Suspense` boundary.

## Step component contract

```ts
type StepProps = {
  onComplete: () => void;
  onSkip?: () => void;  // optional: some steps can be skipped
};
```

- `onComplete`: advance and mark step as done
- `onSkip`: advance without persisting setup (e.g. skip profile photo)

## Files

- Route: `src/routes/onboarding.tsx` (top-level, outside the `_app` dashboard shell)

## Triggering onboarding

New users are redirected to `/onboarding` by the `_app.tsx` layout's `beforeLoad` when the bootstrap payload's `onboardingComplete` is false. `completeOnboardingFn` sets the flag (and invalidates the bootstrap cache) in the final step's `onComplete`.
