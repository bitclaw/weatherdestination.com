import { useRouterState } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import LoadingBar, { type LoadingBarRef } from 'react-top-loading-bar';

export function NavigationProgress() {
  const ref = useRef<LoadingBarRef>(null);
  const status = useRouterState({ select: s => s.status });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (status === 'pending') {
      ref.current?.continuousStart();
    } else {
      ref.current?.complete();
    }
  }, [status]);

  if (!mounted) return null;

  return (
    <LoadingBar color="var(--muted-foreground)" height={2} ref={ref} shadow />
  );
}
