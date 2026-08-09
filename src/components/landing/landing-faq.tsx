import * as Accordion from '@radix-ui/react-accordion';
import { AnimatePresence, MotionConfig, motion, useInView } from 'motion/react';
import { useRef, useState } from 'react';
import { config } from '@/config';
import { cn } from '@/lib/cn';

const faqs = [
  {
    id: 'what-do-i-get',
    question: 'What do I get with this template?',
    answer: `A production-ready TanStack Start app with OTP auth (better-auth), Stripe billing, per-user SQLite databases, a blog with MDX, and a landing page. Everything wired together and ready to customize for ${config.appName}.`
  },
  {
    id: 'per-user-sqlite',
    question: 'Why per-user SQLite instead of a shared database?',
    answer:
      'Each user gets their own isolated SQLite file. No cross-user data leaks, no shared table contention, easy per-user backups. It works great for B2C apps where user data is independent.'
  },
  {
    id: 'own-database',
    question: 'Can I use my own database for the user data?',
    answer:
      'Yes. The per-user SQLite pattern is in src/db/user-db.ts and user-migrations.ts , swap it out for any storage you like. The auth and billing layers are independent.'
  },
  {
    id: 'billing',
    question: 'How does billing work?',
    answer:
      'Stripe Checkout handles payment. A webhook sets hasAccess: true on the user record. That one boolean is all you need to gate Pro features. No complex plan enforcement , you add limits yourself.'
  },
  {
    id: 'bun',
    question: 'Does this work with Bun?',
    answer:
      'Yes, Bun is the required runtime. The bun:sqlite driver is used for all database connections , it is 3-6x faster than better-sqlite3.'
  },
  {
    id: 'b2b',
    question: 'Can I use this for a B2B/team product?',
    answer:
      'The template ships as B2C (one user, no teams). The CLAUDE.md documents the upgrade path to a workspace + multi-session model when you need isolated environments per project.'
  }
];

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqs.map(faq => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: faq.answer
    }
  }))
};

type FaqItemProps = {
  item: (typeof faqs)[number];
  isOpen: boolean;
  setValue: (value: string) => void;
};

function FaqItem({ isOpen, item, setValue }: FaqItemProps) {
  return (
    <Accordion.Item className="relative px-5 py-5" value={item.id}>
      <Accordion.Header>
        <Accordion.Trigger asChild>
          <motion.button
            className="group flex w-full items-center justify-between gap-4 border-none p-0 text-left font-medium"
            onClick={() => setValue(isOpen ? '' : item.id)}
            whileTap={{ scale: 0.99 }}
          >
            <span className="group-hover:text-primary transition-colors">
              {item.question}
            </span>
            <motion.svg
              animate={{ rotate: isOpen ? 180 : 0 }}
              className="text-muted-foreground group-hover:text-primary h-5 w-5 shrink-0 transition-colors"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              style={{ willChange: 'transform' }}
              viewBox="0 0 24 24"
            >
              <path d="m6 9 6 6 6-6" />
            </motion.svg>
          </motion.button>
        </Accordion.Trigger>
      </Accordion.Header>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            animate="open"
            className="overflow-hidden"
            exit="closed"
            initial="closed"
            variants={{
              open: {
                height: 'auto',
                opacity: 1,
                filter: 'blur(0px)'
              },
              closed: {
                height: 0,
                opacity: 0,
                filter: 'blur(2px)'
              }
            }}
          >
            <p className="text-muted-foreground pt-4 pb-1 leading-relaxed">
              {item.answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <hr className="border-border absolute right-5 bottom-0 left-5 border-0 border-b last:hidden" />
    </Accordion.Item>
  );
}

export function LandingFaq() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const [value, setValue] = useState('');

  return (
    <section className="bg-muted/30 py-20" id="faq">
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: structured FAQ data for SEO
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        type="application/ld+json"
      />
      <div
        className={cn(
          'mx-auto max-w-3xl px-6 transition-[transform,opacity] duration-700',
          inView ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'
        )}
        ref={ref}
      >
        <h2 className="text-center text-3xl font-bold tracking-tight text-primary md:text-4xl">
          Frequently asked questions
        </h2>

        <MotionConfig
          transition={{ type: 'spring', bounce: 0.2, visualDuration: 0.4 }}
        >
          <Accordion.Root
            className="mt-12 rounded-xl border"
            onValueChange={setValue}
            type="single"
            value={value}
          >
            {faqs.map(faq => (
              <FaqItem
                isOpen={value === faq.id}
                item={faq}
                key={faq.id}
                setValue={setValue}
              />
            ))}
          </Accordion.Root>
        </MotionConfig>
      </div>
    </section>
  );
}
