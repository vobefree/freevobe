import { FileCode2 } from 'lucide-react';
import { Reveal, RevealGroup, RevealItem } from '@/components/motion/reveal';
import { skills } from '@/lib/site';
import { eyebrow, sectionTitle } from '@/lib/tokens';

function slug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export function Skills() {
  return (
    <section id="skills" className="scroll-mt-24 py-20 lg:py-24">
      <div className="vf-shell">
        <Reveal>
          <p className={eyebrow()}>Skills &amp; templates</p>
          <h2 className={sectionTitle()}>Teach Freevobe how you build.</h2>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted">
            Skills are plain Markdown files with YAML frontmatter. Drop them in your project and the
            agent picks them up — no plugins, no rebuild.
          </p>
        </Reveal>

        <RevealGroup className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {skills.map((skill) => (
            <RevealItem key={skill.name}>
              <article className="vf-panel group h-full overflow-hidden">
                <header className="flex items-center gap-2 border-b border-line bg-card-strong/50 px-4 py-2.5">
                  <FileCode2 className="size-3.5 text-accent-soft" />
                  <span className="font-mono text-[11.5px] text-muted">
                    {slug(skill.name)}.md
                  </span>
                  <span className="ml-auto rounded border border-line px-1.5 py-0.5 text-[9.5px] tracking-wide text-muted uppercase">
                    skill
                  </span>
                </header>

                <div className="vf-code px-4 py-3">
                  <p className="text-muted/70">---</p>
                  <p className="text-teal">
                    name: <span className="text-fg">{slug(skill.name)}</span>
                  </p>
                  <p className="text-teal">
                    description: <span className="text-fg">“{skill.description}”</span>
                  </p>
                  <p className="text-teal">
                    tools: <span className="text-fg">[read, edit, terminal]</span>
                  </p>
                  <p className="text-muted/70">---</p>
                  <p className="mt-2 text-muted">{skill.body}</p>
                </div>

                <footer className="border-t border-line px-4 py-2.5">
                  <p className="text-[12px] text-muted transition-colors group-hover:text-fg">
                    {skill.name}
                  </p>
                </footer>
              </article>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}
