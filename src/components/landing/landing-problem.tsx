import { AnimateIn } from '@/components/ui/animate-in';

const Arrow = ({ flip = false }: { flip?: boolean }) => (
  <svg
    aria-hidden="true"
    className={`text-muted-foreground/40 h-12 w-12 shrink-0 fill-current ${flip ? 'max-md:-scale-x-100 md:-rotate-90' : 'md:-scale-x-100 md:-rotate-90'}`}
    fill="none"
    viewBox="0 0 138 138"
    xmlns="http://www.w3.org/2000/svg"
  >
    <g>
      <path
        clipRule="evenodd"
        d="M72.9644 5.31431C98.8774 43.8211 83.3812 88.048 54.9567 120.735C54.4696 121.298 54.5274 122.151 55.0896 122.639C55.6518 123.126 56.5051 123.068 56.9922 122.506C86.2147 88.9044 101.84 43.3918 75.2003 3.80657C74.7866 3.18904 73.9486 3.02602 73.3287 3.44222C72.7113 3.85613 72.5484 4.69426 72.9644 5.31431Z"
        fillRule="evenodd"
      />
      <path
        clipRule="evenodd"
        d="M56.5084 121.007C56.9835 118.685 57.6119 115.777 57.6736 115.445C59.3456 106.446 59.5323 97.67 58.4433 88.5628C58.3558 87.8236 57.6824 87.2948 56.9433 87.3824C56.2042 87.4699 55.6756 88.1435 55.7631 88.8828C56.8219 97.7138 56.6432 106.225 55.0203 114.954C54.926 115.463 53.5093 121.999 53.3221 123.342C53.2427 123.893 53.3688 124.229 53.4061 124.305C53.5887 124.719 53.8782 124.911 54.1287 125.015C54.4123 125.13 54.9267 125.205 55.5376 124.926C56.1758 124.631 57.3434 123.699 57.6571 123.487C62.3995 120.309 67.4155 116.348 72.791 113.634C77.9171 111.045 83.3769 109.588 89.255 111.269C89.9704 111.475 90.7181 111.057 90.9235 110.342C91.1288 109.626 90.7117 108.878 89.9963 108.673C83.424 106.794 77.3049 108.33 71.5763 111.223C66.2328 113.922 61.2322 117.814 56.5084 121.007Z"
        fillRule="evenodd"
      />
    </g>
  </svg>
);

const Step = ({ emoji, text }: { emoji: string; text: string }) => (
  <div className="flex w-full flex-col items-center justify-center gap-2 md:w-48">
    <span className="text-4xl">{emoji}</span>
    <h3 className="text-foreground text-center font-semibold">{text}</h3>
  </div>
);

export function LandingProblem() {
  return (
    <section className="bg-muted/50 px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <AnimateIn className="text-center">
          <h2 className="mx-auto max-w-3xl text-3xl font-bold tracking-tight md:text-4xl">
            Picking a place to live shouldn't be a guess
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-xl text-lg">
            Wildfire zones, flood plains, hurricane paths, gray winters: the
            risk is real, but it's scattered across a dozen sites you'd never
            think to check before moving or booking a long stay.
          </p>
        </AnimateIn>

        <AnimateIn className="mt-16" delay={0.15}>
          <div className="flex flex-col items-center justify-center gap-6 md:flex-row md:items-start">
            <Step emoji="🤔" text="Pick a city off vibes and Instagram" />
            <Arrow flip />
            <Step emoji="🔥" text="Discover the wildfire risk after moving" />
            <Arrow />
            <Step emoji="😞" text="Stuck somewhere that doesn't fit" />
          </div>
        </AnimateIn>
      </div>
    </section>
  );
}
