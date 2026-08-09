# CommandMenu

A keyboard-driven command palette (`⌘K` / `Ctrl+K`) that renders in the dashboard header. Built with shadcn's Command component (cmdk).

Component: `src/components/command-menu.tsx`

## Usage

`<CommandMenu />` is already mounted in `src/components/layout/header.tsx`. It activates on `⌘K` (Mac) or `Ctrl+K` (Windows/Linux).

To add commands, edit the command list inside `command-menu.tsx`. Commands are grouped by category and support keyboard navigation.

## Customization

The command menu uses shadcn's `<Command>` primitives , `<CommandInput>`, `<CommandList>`, `<CommandGroup>`, `<CommandItem>`. Add new items inside `<CommandGroup>`:

```tsx
<CommandGroup heading="Navigation">
  <CommandItem onSelect={() => navigate({ to: '/dashboard/my-feature' })}>
    <MyIcon className="mr-2 h-4 w-4" />
    My Feature
  </CommandItem>
</CommandGroup>
```

`onSelect` fires on click or Enter. Close the menu by setting `open` to false or calling the provided `setOpen` handler.
