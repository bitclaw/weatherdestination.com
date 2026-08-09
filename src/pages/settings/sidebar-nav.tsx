import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import type { JSX } from 'react';
import { useState } from 'react';
import { buttonVariants } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

type SidebarNavItem = {
  href: string;
  title: string;
  icon: JSX.Element;
};

type SidebarNavProps = React.HTMLAttributes<HTMLElement> & {
  items: SidebarNavItem[];
};

export function SidebarNav({ className, items, ...props }: SidebarNavProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [val, setVal] = useState(pathname ?? '/dashboard/settings');

  const handleSelect = (e: string) => {
    setVal(e);
    navigate({ to: e });
  };

  return (
    <>
      <div className="p-1 md:hidden">
        <Select onValueChange={handleSelect} value={val}>
          <SelectTrigger className="h-12 sm:w-48">
            <SelectValue placeholder="Section" />
          </SelectTrigger>
          <SelectContent>
            {items.map(item => (
              <SelectItem key={item.href} value={item.href}>
                <div className="flex gap-x-4 px-2 py-1">
                  <span className="scale-125">{item.icon}</span>
                  <span className="text-md">{item.title}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <nav
        className={cn(
          'hidden w-full min-w-40 px-1 py-2 md:flex md:flex-col md:space-y-1',
          className
        )}
        {...props}
      >
        {items.map(item => (
          <Link
            className={cn(
              buttonVariants({ variant: 'ghost' }),
              pathname === item.href
                ? 'bg-muted text-primary font-medium hover:bg-muted'
                : 'hover:bg-muted hover:text-primary',
              'justify-start'
            )}
            key={item.href}
            to={item.href}
          >
            <span className="me-2">{item.icon}</span>
            {item.title}
          </Link>
        ))}
      </nav>
    </>
  );
}
