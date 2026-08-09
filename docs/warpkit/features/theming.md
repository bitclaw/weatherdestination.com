# Theming

Warpkit uses shadcn/ui's CSS variable system. The entire look of your app lives in two blocks in `src/styles.css`: `:root` (light mode) and `.dark` (dark mode). Swap the palette without touching any component code.

## Swap the palette: one command

1. Browse presets at **https://ui.shadcn.com/create**
2. Click **Shuffle** until you find something you like
3. Click **Get code** and copy the preset code (e.g. `b4r0BkVlEX`)
4. Run:

```bash
bun run theme <preset-code>
# example:
bun run theme b4r0BkVlEX
```

This rewrites only the CSS vars in `src/styles.css` and updates `baseColor` in `components.json`. Your component code is untouched.

More palettes at **https://ui.shadcn.com/themes**.

## What each variable group controls

| Variables | Controls |
|-----------|----------|
| `--background`, `--foreground` | Page background and body text |
| `--primary`, `--primary-foreground` | Buttons, links, active states |
| `--secondary`, `--muted`, `--accent` | Secondary buttons, muted text, hover states |
| `--destructive` | Error / danger states |
| `--border`, `--input`, `--ring` | Form inputs, focus rings |
| `--radius` | Border radius: all components derive from this single value |
| `--sidebar-*` | Sidebar-specific tokens |
| `--chart-*` | Data visualization colors |

## Change the font

The `theme` command applies any font bundled in a preset. To change fonts manually:

1. Install a `@fontsource-variable/*` package:
   ```bash
   bun add @fontsource-variable/geist
   ```
2. In `src/styles.css`, swap the import:
   ```css
   @import '@fontsource-variable/geist';
   ```
3. Update the `font-family` in the `body` block to match.

To apply theme and font together from a preset:

```bash
bunx --bun shadcn@latest apply <preset-code> --only theme,font -y
```

## How it works

`bun run theme` is a thin wrapper around:

```bash
bunx shadcn apply <preset-code> --only theme -y
```

The `shadcn apply` command fetches the preset from ui.shadcn.com, extracts the CSS variable values, and writes them into `src/styles.css`. It also updates `baseColor` in `components.json` so future `bunx shadcn add` calls use the right base.

## Related

- [UI Components](./ui-components.md) , pre-installed shadcn components and custom additions
