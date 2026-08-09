import * as Accordion from '@radix-ui/react-accordion';
import { AnimatePresence, MotionConfig, motion, useInView } from 'motion/react';
import { useRef, useState } from 'react';
import { cn } from '@/lib/cn';

const faqs = [
  {
    id: 'is-it-free',
    question: 'Is this free?',
    answer:
      'Yes. Comparing cities is free and doesn’t require an account. We may add a paid, more detailed relocation report later, but the comparison tool itself stays free.'
  },
  {
    id: 'which-cities',
    question: 'Which cities are covered?',
    answer:
      '82 US cities spanning every region, from the Pacific Northwest to the Southeast, chosen to give a real spread of climate risk profiles rather than just the biggest metros.'
  },
  {
    id: 'data-source',
    question: 'Where does the data come from?',
    answer:
      "Weather and climate normals come from NOAA's Climate Data Online API. Risk scores, cost of living, and air quality are curated per city and refreshed periodically."
  },
  {
    id: 'risk-scores',
    question: 'How are the risk scores calculated?',
    answer:
      'Each city gets a 0-100 score for wildfire, flood, hurricane, heat wave, and drought risk, where higher means greater risk. These are directional estimates for comparison, not a substitute for local disclosures or insurance underwriting.'
  },
  {
    id: 'account-needed',
    question: 'Do I need to create an account?',
    answer:
      "No. Comparisons run without signing up. Leave your email on a comparison page if you'd like to hear when deeper, downloadable reports launch."
  },
  {
    id: 'more-cities',
    question: 'Will more cities be added?',
    answer:
      "That's the plan. The 82-city list is a starting point, and coverage will grow based on demand."
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
