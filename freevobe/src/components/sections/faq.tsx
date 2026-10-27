import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Reveal } from '@/components/motion/reveal';
import { faqs } from '@/lib/site';
import { eyebrow, sectionTitle } from '@/lib/tokens';

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-24 py-20 lg:py-24">
      <div className="vf-shell grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <Reveal>
          <p className={eyebrow()}>FAQ</p>
          <h2 className={sectionTitle()}>Questions, answered.</h2>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-muted">
            Still curious? The docs cover the agent loop, skills and MCP in detail.
          </p>
        </Reveal>

        <Reveal delay={0.08}>
          <Accordion type="single" collapsible className="vf-panel px-6 py-2">
            {faqs.map((faq, index) => (
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
