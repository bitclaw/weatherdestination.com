import * as ToastPrimitive from '@radix-ui/react-toast';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState
} from 'react';

type ToastVariant = 'success' | 'error' | 'default';

type ToastAction = {
  label: string;
  onClick: () => void;
};

type ToastItem = {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
  action?: ToastAction;
};

type ToastOptions = {
  description?: string;
  duration?: number;
  action?: ToastAction;
};

type ToastListener = (item: ToastItem) => void;

const listeners = new Set<ToastListener>();

const emitToast = (item: ToastItem) => {
  for (const listener of listeners) {
    listener(item);
  }
};

let toastCounter = 0;

const createToast = (
  title: string,
  variant: ToastVariant,
  opts?: ToastOptions
): void => {
  emitToast({
    id: String(++toastCounter),
    title,
    variant,
    description: opts?.description,
    duration: opts?.duration ?? 4000,
    action: opts?.action
  });
};

export const toast = {
  success: (title: string, opts?: ToastOptions) =>
    createToast(title, 'success', opts),
  error: (title: string, opts?: ToastOptions) =>
    createToast(title, 'error', opts),
  info: (title: string, opts?: ToastOptions) =>
    createToast(title, 'default', opts)
};

const ToastContext = createContext<typeof toast | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a <ToastProvider>');
  return ctx;
}

const variantConfig: Record<
  ToastVariant,
  { icon: typeof CheckCircle2; iconClass: string }
> = {
  success: { icon: CheckCircle2, iconClass: 'text-success' },
  error: { icon: XCircle, iconClass: 'text-destructive' },
  default: { icon: Info, iconClass: 'text-info' }
};

function ToastItemComponent({
  item,
  onRemove
}: {
  item: ToastItem;
  onRemove: (id: string) => void;
}) {
  const { icon: Icon, iconClass } = variantConfig[item.variant];

  return (
    <ToastPrimitive.Root
      className="bg-background border-border pointer-events-auto grid grid-cols-[auto_1fr_auto] items-start gap-3 rounded-lg border p-4 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-80 data-[state=open]:slide-in-from-right-full data-[state=closed]:slide-out-to-right-full"
      duration={item.duration}
      onOpenChange={open => {
        if (!open) onRemove(item.id);
      }}
    >
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconClass}`} />
      <div className="min-w-0">
        <ToastPrimitive.Title className="text-foreground text-sm font-medium">
          {item.title}
        </ToastPrimitive.Title>
        {item.description && (
          <ToastPrimitive.Description className="text-muted-foreground mt-1 text-sm">
            {item.description}
          </ToastPrimitive.Description>
        )}
        {item.action && (
          <ToastPrimitive.Action altText={item.action.label} asChild>
            <button
              className="text-primary mt-2 text-sm font-medium hover:underline"
              onClick={item.action.onClick}
              type="button"
            >
              {item.action.label}
            </button>
          </ToastPrimitive.Action>
        )}
      </div>
      <ToastPrimitive.Close aria-label="Dismiss" asChild>
        <button
          className="text-muted-foreground hover:text-foreground rounded p-1 transition-colors"
          type="button"
        >
          <X className="h-4 w-4" />
        </button>
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((item: ToastItem) => {
    setToasts(prev => [...prev, item]);
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  useEffect(() => {
    listeners.add(addToast);
    return () => {
      listeners.delete(addToast);
    };
  }, [addToast]);

  return (
    <ToastContext.Provider value={toast}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        {toasts.map(item => (
          <ToastItemComponent
            item={item}
            key={item.id}
            onRemove={removeToast}
          />
        ))}
        <ToastPrimitive.Viewport className="fixed bottom-0 right-0 z-50 flex w-[390px] max-w-[100vw] flex-col gap-2 p-6" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}
