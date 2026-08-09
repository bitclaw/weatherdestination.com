import { useState } from 'react';

// Wraps the repeated setError(null) -> setPending(true) -> try/catch/finally
// shape around a server-fn call. The callback still checks `res.ok` and calls
// `setError` itself on a Result error branch; this hook only owns the
// pending/error state and the catch-unexpected-throw fallback.
export function useAsyncAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>): Promise<void> => {
    setError(null);
    setPending(true);
    try {
      await fn();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setPending(false);
    }
  };

  return { pending, error, setError, run };
}
