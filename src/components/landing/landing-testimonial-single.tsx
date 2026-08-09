import { AnimateIn } from '@/components/ui/animate-in';

// TODO: replace with a real testimonial from a happy customer
const testimonial = {
  text: 'I cloned it Friday, had a working MVP live by Sunday. The Stripe integration alone saved me two days. Auth, billing, database: all pre-wired. I just had to build the actual product.',
  name: 'Alex Johnson',
  title: 'Founder, ExampleApp',
  img: ''
};

// Single featured testimonial: use as a standalone section or between landing sections.
// Not included in LandingPage by default.
export function LandingTestimonialSingle() {
  const initials = testimonial.name
    .split(' ')
    .map(n => n[0])
    .join('');

  return (
    <section className="px-6 py-24">
      <AnimateIn className="relative mx-auto max-w-3xl text-center">
        <span className="bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200 absolute top-0 left-1/2 -translate-x-1/2 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase">
          Sample , replace before launch
        </span>
        <div
          aria-label="5 stars"
          className="mb-6 flex justify-center gap-1"
          role="img"
        >
          {(['1', '2', '3', '4', '5'] as const).map(n => (
            <svg
              aria-hidden="true"
              className="text-yellow-400 h-5 w-5 fill-current"
              key={n}
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
        </div>

        <blockquote className="text-foreground mx-auto max-w-2xl text-xl leading-relaxed font-medium">
          "{testimonial.text}"
        </blockquote>

        <div className="mt-8 flex items-center justify-center gap-3">
          {testimonial.img ? (
            <img
              alt={testimonial.name}
              className="h-12 w-12 rounded-full object-cover"
              src={testimonial.img}
            />
          ) : (
            <div className="bg-primary/10 text-primary flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold">
              {initials}
            </div>
          )}
          <div className="text-left">
            <p className="font-semibold">{testimonial.name}</p>
            <p className="text-muted-foreground text-sm">{testimonial.title}</p>
          </div>
        </div>
      </AnimateIn>
    </section>
  );
}
