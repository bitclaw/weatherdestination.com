import { cn } from '@/lib/utils';

type MainProps = React.HTMLAttributes<HTMLElement> & {
  // true: always fixed (inner scroll). 'desktop': fixed at lg+ only, normal
  // page scroll on mobile, where a nested scroll box under the header is
  // cramped (settings).
  fixed?: boolean | 'desktop';
};

const layoutOf = (fixed: MainProps['fixed']) => {
  if (fixed === 'desktop') return 'fixed-desktop';
  return fixed ? 'fixed' : 'auto';
};

export const Main = ({ className, fixed, children, ...props }: MainProps) => (
  <main
    className={cn(
      'flex flex-1 flex-col px-4 py-6 sm:px-6 @7xl/content:mx-auto @7xl/content:w-full @7xl/content:max-w-7xl',
      fixed === true && 'overflow-hidden',
      fixed === 'desktop' && 'lg:overflow-hidden',
      className
    )}
    data-layout={layoutOf(fixed)}
    id="main-content"
    {...props}
  >
    {children}
  </main>
);
