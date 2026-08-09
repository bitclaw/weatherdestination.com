import { CloudSunRain } from 'lucide-react';

type LogoProps = {
  className?: string;
};

export function Logo({ className = 'h-7 w-7' }: LogoProps) {
  return <CloudSunRain aria-hidden="true" className={className} />;
}
