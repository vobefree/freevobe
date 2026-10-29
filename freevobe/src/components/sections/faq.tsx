import { useTranslations } from 'next-intl';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Reveal } from '@/components/motion/reveal';
import { eyebrow, sectionTitle } from '@/lib/tokens';

type Item = { question: string; answer: string };

export function Faq() {
  const t = useTranslations('faq');
  const items = t.raw('items') as Item[];

  return (
    <section id="faq" className="scroll-mt-24 py-20 lg:py-24">
      <div className="vf-shell grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Reveal>
          <p className={eyebrow()}>{t('eyebrow')}</p>
          <h2 className={sectionTitle()}>{t('heading')}</h2>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted">{t('body')}</p>
        </Reveal>

        <Reveal delay={0.08}>
          <Accordion type="single" collapsible className="vf-panel px-6 py-2">
            {items.map((faq, index) => (
              <AccordionItem key={faq.question} value={`item-${index}`}>
                <AccordionTrigger>{faq.question}</AccordionTrigger>
                <AccordionContent>{faq.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}
