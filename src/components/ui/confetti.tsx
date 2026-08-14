/**
 * Confetti burst component adapted from motion.dev examples.
 * Physics model derived from canvas-confetti by Kiril Vatev (ISC License).
 *
 * Usage:
 *   const { burst, ConfettiLayer } = useConfetti()
 *   burst()  // fire a burst
 *   <ConfettiLayer />  // render in JSX (position:relative parent recommended)
 */
import { animate } from 'motion/react';
import { useRef, useState } from 'react';

type ParticleShape = 'circle' | 'rect' | 'strip';

type Particle = {
  id: number;
  keyframes: { transform: string[]; opacity: number[] };
  duration: number;
  size: number;
  color: string;
  shape: ParticleShape;
};

type Burst = {
  id: number;
  particles: Particle[];
};

const COLORS = [
  '#26ccff',
  '#a25afd',
  '#ff5e7e',
  '#88ff5a',
  '#fcff42',
  '#ffa62d',
  '#ff36ff'
];

const SHAPES: ParticleShape[] = ['circle', 'rect', 'rect', 'strip', 'strip'];

const KEYFRAME_STEPS = 40;
const SCALE_DURATION_FRACTION = 0.08;

const computeKeyframes = (params: {
  angle: number;
  startVelocity: number;
  decay: number;
  gravity: number;
  drift: number;
  wobbleSpeed: number;
  wobbleOffset: number;
  size: number;
  ticks: number;
  tiltRotations: number;
  rotation: number;
}) => {
  const {
    angle,
    startVelocity,
    decay,
    gravity,
    drift,
    wobbleSpeed,
    wobbleOffset,
    size,
    ticks,
    tiltRotations,
    rotation
  } = params;

  const transform: string[] = [];
  const opacity: number[] = [];

  let velocity = startVelocity;
  let x = 0;
  let y = 0;
  let wobble = wobbleOffset;
  let tick = 0;

  for (let step = 0; step <= KEYFRAME_STEPS; step++) {
    const t = step / KEYFRAME_STEPS;

    if (step > 0) {
      const targetTick = Math.round((step * ticks) / KEYFRAME_STEPS);
      while (tick < targetTick) {
        x += Math.cos(angle) * velocity + drift;
        y += Math.sin(angle) * velocity + gravity * 3;
        velocity *= decay;
        wobble += wobbleSpeed;
        tick++;
      }
    }

    const wx = step === 0 ? 0 : x + Math.cos(wobble) * 15 * size;
    const wy = y;

    let scale: number;
    if (t < SCALE_DURATION_FRACTION * 0.6) {
      scale = (t / (SCALE_DURATION_FRACTION * 0.6)) * 1.15;
    } else if (t < SCALE_DURATION_FRACTION) {
      const st =
        (t - SCALE_DURATION_FRACTION * 0.6) / (SCALE_DURATION_FRACTION * 0.4);
      scale = 1.15 - st * 0.15;
    } else {
      scale = 1;
    }

    const rotateY = tiltRotations * 360 * t;

    let opacityVal: number;
    if (t <= 0.5) {
      opacityVal = 1;
    } else if (t <= 0.8) {
      opacityVal = 1 - ((t - 0.5) / 0.3) * 0.5;
    } else {
      opacityVal = 0.5 - ((t - 0.8) / 0.2) * 0.5;
    }

    transform.push(
      `translate(${wx}px, ${wy}px) scale(${scale}) rotateY(${rotateY}deg) rotate(${rotation}deg)`
    );
    opacity.push(opacityVal);
  }

  return { transform, opacity };
};

const WIDTH_FACTOR: Record<ParticleShape, number> = {
  strip: 0.3,
  rect: 0.7,
  circle: 1
};
const BORDER_RADIUS: Record<ParticleShape, (size: number) => number | string> =
  {
    circle: () => '50%',
    strip: size => size * 0.12,
    rect: () => 2
  };

function ConfettiPiece({ particle }: { particle: Particle }) {
  const { keyframes, duration, size, color, shape } = particle;

  const width = size * WIDTH_FACTOR[shape];
  const height = shape === 'strip' ? size * 2 : size;
  const borderRadius = BORDER_RADIUS[shape](size);

  const callbackRef = (node: HTMLDivElement | null) => {
    if (!node) return;
    const animation = animate(node, keyframes, { duration, ease: 'linear' });
    return () => animation.cancel();
  };

  return (
    <div
      ref={callbackRef}
      style={{
        position: 'absolute',
        width,
        height,
        borderRadius,
        backgroundColor: color,
        willChange: 'transform, opacity',
        pointerEvents: 'none'
      }}
    />
  );
}

export function useConfetti({
  particleCount = 50,
  startVelocity = 25,
  spread = 100,
  decay = 0.91,
  gravity = 1,
  drift = 0,
  duration = 2.5,
  size = 1,
  colors = COLORS
} = {}) {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const nextId = useRef(0);

  const burst = () => {
    const id = nextId.current++;
    const ticks = Math.round(duration * 60);

    let particleId = 0;
    const particles: Particle[] = Array.from({ length: particleCount }, () => {
      const radSpread = spread * (Math.PI / 180);
      const angle =
        -Math.PI / 2 + (0.5 * radSpread - Math.random() * radSpread);
      const velocity = startVelocity * 0.5 + Math.random() * startVelocity;
      const wobbleSpeed = Math.min(0.11, Math.random() * 0.1 + 0.05);
      const wobbleOffset = Math.random() * 10;
      const pieceSize = 6 * size + Math.random() * 6 * size;
      const tiltRotations = 2 + Math.random() * 4;
      const rotation = Math.random() * 360;

      const keyframes = computeKeyframes({
        angle,
        startVelocity: velocity,
        decay,
        gravity,
        drift,
        wobbleSpeed,
        wobbleOffset,
        size,
        ticks,
        tiltRotations,
        rotation
      });

      return {
        id: particleId++,
        keyframes,
        duration,
        size: pieceSize,
        color: colors[Math.floor(Math.random() * colors.length)]!,
        shape: SHAPES[Math.floor(Math.random() * SHAPES.length)]!
      };
    });

    setBursts(prev => [...prev, { id, particles }]);
    setTimeout(
      () => setBursts(prev => prev.filter(b => b.id !== id)),
      (duration + 0.5) * 1000
    );
  };

  const ConfettiLayer = () => (
    <>
      {bursts.map(b => (
        <div
          key={b.id}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            pointerEvents: 'none',
            zIndex: 10000
          }}
        >
          {b.particles.map(p => (
            <ConfettiPiece key={p.id} particle={p} />
          ))}
        </div>
      ))}
    </>
  );

  return { burst, ConfettiLayer };
}
