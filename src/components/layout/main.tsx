import { cn } from '@/lib/utils';

type MainProps = React.HTMLAttributes<HTMLElement> & {
  fixed?: boolean;
};

export const Main = ({ className, fixed, children, ...props }: MainProps) => (
  <main
    className={cn(
      'flex flex-1 flex-col px-4 py-6 sm:px-6 @7xl/content:mx-auto @7xl/content:w-full @7xl/content:max-w-7xl',
      fixed && 'overflow-hidden',
      className
    )}
    data-layout={fixed ? 'fixed' : 'auto'}
    id="main-content"
    {...props}
  >
    {children}
  </main>
);
