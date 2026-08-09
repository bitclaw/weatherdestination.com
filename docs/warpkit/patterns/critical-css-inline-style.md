# Critical CSS and Inline `<style>` Tags

Warpkit's build inlines critical CSS into the prerendered landing page via
Beasties (`scripts/inline-critical-css.ts`, run as a postbuild step). Beasties
hoists **every** `<style>` tag on the page into `<head>` during that pass -
not just the main stylesheet `<link>`. A component-local
`<style>{...}</style>` JSX tag gets moved out of its original position in
the prerendered HTML.

## The failure mode

If any component renders a `<style>` tag as a JSX child (e.g. for a one-off
`@keyframes` animation), the prerendered HTML Beasties produces no longer
matches the DOM structure the client bundle expects to hydrate - the
`<style>` node is gone from its original spot, relocated into `<head>`.
React sees a real structural mismatch and throws `Minified React error #418`
on every production page load. It won't reproduce in `vite dev` (no Beasties
pass) or an unminified dev build, which makes it easy to mistake for
something else entirely - the actual failing component's identity is
stripped out of the minified error message.

## Diagnosing it

`src/client.tsx` overrides `@tanstack/react-start`'s default client entry
(same convention as `src/start.ts` overriding the server entry - detected by
file path, no `vite.config.ts` change needed) to pass `onRecoverableError`
to `hydrateRoot`. Its `componentStack` survives minification (built from
component/function names, not the stripped message), so a real production
hydration mismatch shows exactly which component tree it came from instead
of just an error code. If you see `#418` and the stack points at a `style`
node, this is almost certainly the cause - confirm by grepping a real
production build's `dist/client/index.html` for the `@keyframes`/selector
content that should be inside your component; if it's sitting in `<head>`
instead, Beasties moved it.

## The fix

Move component-local CSS into a real stylesheet - `src/styles.css`, or a
CSS Module if the project uses one - instead of a JSX-rendered `<style>`
node. A real stylesheet has nothing for Beasties to relocate, because
nothing about its position in the DOM tree is meaningful the way a JSX
child's position is.

```tsx
// WRONG - a component-local <style> tag is a real DOM node Beasties can move
export function AnimatedWidget() {
  return (
    <div>
      <style>{`@keyframes spin-in { ... }`}</style>
      <div className="spin-in-item" />
    </div>
  );
}
```

```css
/* RIGHT - src/styles.css, not relocatable because it isn't part of the JSX tree */
@keyframes spin-in {
  ...;
}
```

```tsx
export function AnimatedWidget() {
  return <div className="spin-in-item" />;
}
```
