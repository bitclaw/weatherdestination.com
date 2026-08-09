import { useNavigate } from '@tanstack/react-router';
import { ChevronRight, Laptop, Moon, Search, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { getSidebarData } from '@/components/layout/sidebar-data';
import { Button } from '@/components/ui/button';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from '@/components/ui/command';
import { useTheme } from '@/hooks/use-theme';

export function CommandMenu() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { setTheme } = useTheme();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  const runCommand = (command: () => unknown) => {
    setOpen(false);
    command();
  };

  const navGroups = getSidebarData(false);

  return (
    <>
      <Button
        aria-keyshortcuts="Meta+K Control+K"
        className="group relative h-8 w-full flex-1 justify-start bg-muted/25 text-sm font-normal text-muted-foreground shadow-none sm:w-40 sm:pe-12 md:flex-none lg:w-52 xl:w-64"
        onClick={() => setOpen(true)}
        type="button"
        variant="outline"
      >
        <Search
          aria-hidden="true"
          className="absolute start-1.5 top-1/2 size-4 -translate-y-1/2"
        />
        <span className="ms-4">Search</span>
        <kbd className="pointer-events-none absolute end-[0.3rem] top-[0.3rem] hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 group-hover:bg-accent sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>
      <CommandDialog onOpenChange={setOpen} open={open}>
        <CommandInput placeholder="Type a command or search..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          {navGroups.map(group => (
            <CommandGroup heading={group.title} key={group.title}>
              {group.items.map((navItem, i) => {
                if ('url' in navItem && navItem.url) {
                  return (
                    <CommandItem
                      // biome-ignore lint/suspicious/noArrayIndexKey: nav items may share titles
                      key={`${navItem.url}-${i}`}
                      onSelect={() =>
                        runCommand(() =>
                          navigate({ to: navItem.url as string })
                        )
                      }
                      value={navItem.title}
                    >
                      {navItem.icon && <navItem.icon className="size-4" />}
                      {navItem.title}
                    </CommandItem>
                  );
                }

                if ('items' in navItem && navItem.items) {
                  return navItem.items.map((subItem, j) => (
                    <CommandItem
                      // biome-ignore lint/suspicious/noArrayIndexKey: sub-items may share titles
                      key={`${navItem.title}-${subItem.url}-${j}`}
                      onSelect={() =>
                        runCommand(() =>
                          navigate({ to: subItem.url as string })
                        )
                      }
                      value={`${navItem.title} ${subItem.title}`}
                    >
                      {navItem.title} <ChevronRight className="size-3" />{' '}
                      {subItem.title}
                    </CommandItem>
                  ));
                }

                return null;
              })}
            </CommandGroup>
          ))}
          <CommandSeparator />
          <CommandGroup heading="Theme">
            <CommandItem onSelect={() => runCommand(() => setTheme('light'))}>
              <Sun />
              <span>Light</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setTheme('dark'))}>
              <Moon />
              <span>Dark</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setTheme('system'))}>
              <Laptop />
              <span>System</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
