import { AnimateIn } from '@/components/ui/animate-in';

// ⚠️  REPLACE BEFORE LAUNCH: these are sample quotes , ship with real ones.
// Sources: Twitter/X DMs, Product Hunt reviews, direct emails after first users.
// A link to the original post (tweet URL, PH comment URL) makes each quote 10x
// more credible. Add an `img` URL (their avatar) and a `link` for max trust.
const testimonials = [
  {
    text: 'I shipped my SaaS in a weekend. Auth, billing, and database were already wired , I just had to build the actual product.',
    name: 'Your Customer Name',
    handle: '@their_handle',
    link: '', // e.g. https://twitter.com/their_handle/status/...
    img: '' // their avatar URL, or leave empty for initials fallback
  },
  {
    text: "The per-user SQLite architecture is genius. No shared schema headaches, no row-level security. Each user's data is completely isolated.",
    name: 'Another Customer',
    handle: '@another_handle',
    link: '',
    img: ''
  },
  {
    text: 'Cloned it Friday, had a working MVP live by Sunday. The Stripe integration alone saved me two days. Worth every penny.',
    name: 'Third Customer',
    handle: '@third_handle',
    link: '',
    img: ''
  }
];

type Testimonial = (typeof testimonials)[number];

function TestimonialCard({ testimonial }: { testimonial: Testimonial }) {
  const initials = testimonial.name
    .split(' ')
    .map(n => n[0])
    .join('');

  const figcaption = (
    <figcaption className="mt-6 flex items-center gap-3 border-t pt-4">
      {testimonial.img ? (
        <img
          alt={testimonial.name}
          className="h-10 w-10 rounded-full object-cover"
          src={testimonial.img}
        />
      ) : (
        <div className="bg-muted text-muted-foreground flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium">
          {initials}
        </div>
      )}
      <div className="flex-1">
        <p className="text-sm font-semibold">{testimonial.name}</p>
        <p className="text-muted-foreground text-xs">{testimonial.handle}</p>
      </div>
      {testimonial.link && (
        <a
          className="text-muted-foreground hover:text-foreground transition-colors"
          href={testimonial.link}
          rel="noopener noreferrer"
          target="_blank"
        >
          <span className="sr-only">View original post</span>
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            fill="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        </a>
      )}
    </figcaption>
  );

  return (
    <figure className="bg-background relative flex h-full flex-col rounded-xl border border-dashed border-amber-400/60 p-6 dark:border-amber-500/40">
      <span className="bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 absolute -top-3 left-4 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
        Sample , replace before launch
      </span>
      <blockquote className="text-muted-foreground flex-1 text-sm leading-relaxed">
        "{testimonial.text}"
      </blockquote>
      {figcaption}
    </figure>
  );
}

export function LandingTestimonials() {
  return (
    <section className="bg-muted/30 px-6 py-24" id="testimonials">
      <div className="mx-auto max-w-6xl">
        <AnimateIn className="text-center">
          <h2 className="text-3xl font-bold tracking-tight md:text-4xl">
            What builders are saying
          </h2>
          <p className="text-muted-foreground mx-auto mt-4 max-w-xl">
            Don't take our word for it.
          </p>
        </AnimateIn>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <AnimateIn delay={i * 0.08} key={t.handle}>
              <TestimonialCard testimonial={t} />
            </AnimateIn>
          ))}
        </div>
      </div>
    </section>
  );
}
