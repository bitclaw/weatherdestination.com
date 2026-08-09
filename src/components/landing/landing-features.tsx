import { CloudSun, DollarSign, Flame, Table2, Waves, Wind } from 'lucide-react';
import { motion } from 'motion/react';
import { AnimateIn } from '@/components/ui/animate-in';

const features = [
  {
    icon: Flame,
    title: 'Climate risk scores',
    description:
      'Wildfire, flood, hurricane, heat wave, and drought risk for every city, scored 0-100 so you can compare at a glance.'
  },
  {
    icon: CloudSun,
    title: 'Sunshine and cloud cover',
    description:
      'Average sunshine hours and cloud cover per city, sourced from NOAA climate normals, not marketing copy.'
  },
  {
    icon: Wind,
    title: 'Air quality',
    description:
      'Air Quality Index alongside every comparison, so you know what you’re actually breathing before you move.'
  },
  {
    icon: DollarSign,
    title: 'Cost of living',
    description:
      'Cost of living index next to the climate data, because the sunniest city doesn’t matter if you can’t afford it.'
  },
  {
    icon: Table2,
    title: 'Compare up to 5 cities',
    description:
      'Pick your shortlist and see every metric side by side in one table, instead of a dozen open browser tabs.'
  },
  {
    icon: Waves,
    title: 'Free, no account needed',
    description:
      'Run comparisons without signing up. We only ask for your email if you want to hear about deeper reports later.'
  }
];

export function LandingFeatures() {
  return (
    <section className="bg-muted/30 px-6 py-24" id="features">
      <div className="mx-auto max-w-6xl">
        <AnimateIn className="text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            Everything you need to compare
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-2xl">
            Climate risk and quality-of-life data for 82 US cities, pulled from
            NOAA and refreshed regularly.
          </p>
        </AnimateIn>

        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <AnimateIn delay={i * 0.08} key={feature.title}>
              <motion.div
                className="bg-background group h-full rounded-xl border p-6"
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
              >
                <div className="bg-primary/10 inline-flex rounded-lg p-2">
                  <feature.icon className="text-primary h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold">{feature.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm">
                  {feature.description}
                </p>
              </motion.div>
            </AnimateIn>
          ))}
        </div>
      </div>
    </section>
  );
}
