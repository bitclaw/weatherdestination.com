import {
  AnimatePresence,
  animate,
  motion,
  type Transition,
  useTime,
  useTransform
} from 'motion/react';
import { useEffect, useRef, useState } from 'react';

export type BadgeState = 'idle' | 'processing' | 'success' | 'error';

type IconComponent = React.ComponentType<{ className?: string }>;

type MultiStateBadgeProps = {
  state: BadgeState;
  labels?: Partial<Record<BadgeState, string>>;
  icons?: Partial<Record<BadgeState, IconComponent>>;
  onClick?: () => void;
  className?: string;
};

const SPRING_CONFIG: Transition = {
  type: 'spring',
  stiffness: 600,
  damping: 30
};

const ICON_SIZE = 16;
const STROKE_WIDTH = 1.5;
const VIEW_BOX_SIZE = 24;

const svgProps = {
  width: ICON_SIZE,
  height: ICON_SIZE,
  viewBox: `0 0 ${VIEW_BOX_SIZE} ${VIEW_BOX_SIZE}`,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: STROKE_WIDTH,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const
};

const springConfig: Transition = {
  type: 'spring',
  stiffness: 150,
  damping: 20
};

const pathAnimations = {
  initial: { pathLength: 0 },
  animate: { pathLength: 1 },
  transition: springConfig
};

function Check() {
  return (
    <motion.svg {...svgProps}>
      <motion.polyline points="4 12 9 17 20 6" {...pathAnimations} />
    </motion.svg>
  );
}

function Loader() {
  const time = useTime();
  const rotate = useTransform(time, [0, 1000], [0, 360], { clamp: false });

  return (
    <motion.div
      className="flex items-center justify-center"
      style={{ rotate, width: ICON_SIZE, height: ICON_SIZE }}
    >
      <motion.svg {...svgProps}>
        <motion.path d="M21 12a9 9 0 1 1-6.219-8.56" {...pathAnimations} />
      </motion.svg>
    </motion.div>
  );
}

function X() {
  return (
    <motion.svg {...svgProps}>
      <motion.line x1="6" x2="18" y1="6" y2="18" {...pathAnimations} />
      <motion.line
        x1="18"
        x2="6"
        y1="6"
        y2="18"
        {...pathAnimations}
        transition={{ ...springConfig, delay: 0.1 }}
      />
    </motion.svg>
  );
}

const DEFAULT_ICONS: Record<BadgeState, (() => React.ReactNode) | null> = {
  idle: null,
  processing: () => <Loader />,
  success: () => <Check />,
  error: () => <X />
};

function Icon({
  state,
  customIcons
}: {
  state: BadgeState;
  customIcons?: Partial<Record<BadgeState, IconComponent>>;
}) {
  const CustomIcon = customIcons?.[state];
  const component = CustomIcon ? (
    <CustomIcon className="h-4 w-4 shrink-0" />
  ) : (
    (DEFAULT_ICONS[state]?.() ?? null)
  );

  return (
    <motion.span
      animate={{ width: component === null ? 0 : ICON_SIZE }}
      className="relative flex shrink-0 items-center justify-center overflow-hidden"
      style={{ height: ICON_SIZE }}
      transition={SPRING_CONFIG}
    >
      <AnimatePresence mode="wait">
        <motion.span
          animate={{ y: 0, scale: 1, filter: 'blur(0px)', opacity: 1 }}
          className="flex items-center justify-center"
          exit={{ y: 20, scale: 0.5, filter: 'blur(6px)', opacity: 0 }}
          initial={{ y: -20, scale: 0.5, filter: 'blur(6px)', opacity: 0 }}
          key={state}
          transition={{ duration: 0.15, ease: 'easeInOut' }}
        >
          {component}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  );
}

const DEFAULT_LABELS: Record<BadgeState, string> = {
  idle: 'Idle',
  processing: 'Processing',
  success: 'Done',
  error: 'Error'
};

function Label({
  state,
  labels
}: {
  state: BadgeState;
  labels: Record<BadgeState, string>;
}) {
  const widthsRef = useRef<Record<string, number>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  const labelsKey = Object.values(labels).join('\0');
  // biome-ignore lint/correctness/useExhaustiveDependencies: labelsKey captures label content changes
  useEffect(() => {
    if (!containerRef.current) return;
    const measured: Record<string, number> = {};
    for (const span of containerRef.current.querySelectorAll<HTMLSpanElement>(
      '[data-state]'
    )) {
      const key = span.dataset.state;
      if (key) measured[key] = span.getBoundingClientRect().width;
    }
    widthsRef.current = measured;
    if (!ready) setReady(true);
  }, [labelsKey, ready]);

  const labelWidth = widthsRef.current[state] ?? 0;

  return (
    <>
      <div
        aria-hidden
        className="invisible absolute whitespace-nowrap"
        ref={containerRef}
      >
        {(Object.keys(labels) as BadgeState[]).map(key => (
          <span data-state={key} key={key}>
            {labels[key]}
          </span>
        ))}
      </div>
      <motion.span
        animate={{ width: labelWidth }}
        className="relative overflow-hidden"
        transition={SPRING_CONFIG}
      >
        <AnimatePresence initial={false} mode="sync">
          <motion.div
            animate={{
              y: 0,
              opacity: 1,
              filter: 'blur(0px)',
              position: 'relative'
            }}
            className="whitespace-nowrap"
            exit={{
              y: 20,
              opacity: 0,
              filter: 'blur(10px)',
              position: 'absolute'
            }}
            initial={{
              y: -20,
              opacity: 0,
              filter: 'blur(10px)',
              position: 'absolute'
            }}
            key={state}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            {labels[state]}
          </motion.div>
        </AnimatePresence>
      </motion.span>
    </>
  );
}

export function MultiStateBadge({
  state,
  labels: customLabels,
  icons: customIcons,
  onClick,
  className
}: MultiStateBadgeProps) {
  const badgeRef = useRef<HTMLDivElement>(null);
  const labels = { ...DEFAULT_LABELS, ...customLabels };

  useEffect(() => {
    if (!badgeRef.current) return;

    if (state === 'error') {
      animate(
        badgeRef.current,
        { x: [0, -6, 6, -6, 0] },
        {
          duration: 0.3,
          ease: 'easeInOut',
          times: [0, 0.25, 0.5, 0.75, 1],
          delay: 0.1
        }
      );
    } else if (state === 'success') {
      animate(
        badgeRef.current,
        { scale: [1, 1.2, 1] },
        { duration: 0.3, ease: 'easeInOut', times: [0, 0.5, 1] }
      );
    }
  }, [state]);

  const Wrapper = onClick ? 'button' : 'div';

  return (
    <Wrapper
      className={className}
      {...(onClick ? { onClick, type: 'button' as const } : {})}
    >
      <motion.div
        className="bg-muted text-foreground inline-flex items-center justify-center overflow-hidden rounded-full px-3 py-1.5 text-sm will-change-transform"
        ref={badgeRef}
        style={{ gap: state === 'idle' && !customIcons?.idle ? 0 : 6 }}
      >
        <Icon customIcons={customIcons} state={state} />
        <Label labels={labels} state={state} />
      </motion.div>
    </Wrapper>
  );
}
