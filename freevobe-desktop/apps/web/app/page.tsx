import Link from 'next/link';
import { GivesBackSlot } from '@/components/GivesBackSlot';
import { BLOG_POSTS, GALLERY_SKILLS } from '@/lib/content';

const FEATURES = [
  {
    title: 'Agent-loop med verktyg',
    body: 'Läs, sök, skriv, kör kommandon, kör tester och hantera git. Varje steg syns i loggen och varje ändring blir en diff.',
  },
  {
    title: 'Diff före skrivning',
    body: 'Ingen fil skrivs utan att du sett ändringen. Behörighetslägen från "fråga alltid" till "full auto" – farliga kommandon blockeras ändå.',
  },
  {
    title: 'Smart kontext',
    body: 'Repo map, lokala embeddings och importanalys hittar rätt filer. Bara det som behövs skickas till modellen – aldrig hela repot.',
  },
  {
    title: 'Skills, regler och minne',
    body: 'Skills är Markdown-filer i ditt repo. Regler läses från AGENTS.md och projektminnet ligger versionshanterat i .freevobe/.',
  },
  {
    title: 'MCP och subagents',
    body: 'Koppla MCP-servrar över stdio, HTTP eller SSE. Låt Explorer, Reviewer och Tester arbeta parallellt med isolerad kontext.',
  },
  {
    title: 'Bild, video och ljud',
    body: 'Fem medieverktyg: skapa bild, video och ljud, analysera bilder och filmer. Varje anrop visar priset och kräver ditt godkännande – filen hamnar i projektet, inte i ett moln.',
  },
  {
    title: 'Fler providers, egna nycklar',
    body: 'Claude, Gemini och Grok vid sidan av Ollama. Nycklarna sparas krypterat på datorn, och katalogen visar vilka förmågor och vad varje anrop kostar.',
  },
  {
    title: 'Git och GitHub',
    body: 'Status, branchar, diff, commits med AI-genererat meddelande och ett code review-läge som letar buggar och säkerhetsproblem.',
  },
];

const MEDIA_STEPS = [
  'Beskriv vad du vill ha – "hero-bild i 16:9 till startsidan"',
  'Agenten väljer provider och modell och visar priset',
  'Du godkänner – bilden skapas',
  'Filen sparas i .freevobe/media/ med metadata',
  'Agenten använder filen i koden och kör verifieringen',
];

const SLICE = [
  'Anslut Ollama på localhost:11434',
  'Välj modell med tool calling',
  'Läs en fil i projektet',
  'Föreslå en ändring som diff',
  'Godkänn – filen skrivs',
];

export default function HomePage() {
  return (
    <div className="space-y-16">
      <section className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:items-center">
        <div className="space-y-5">
          <p className="inline-flex rounded-full border border-steel px-3 py-1 text-xs text-slate-400">
            Lokal-first · Ollama + valfria molnproviders · Öppen källkod (MIT)
          </p>
          <h1 className="text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
            Bygg mjukvara genom att <span className="text-ember">samtala</span> med en agent som
            körs på din dator.
          </h1>
          <p className="max-w-xl text-slate-400">
            Freevobe planerar, utforskar kodbasen, skriver kod, kör kommandon, testar, granskar
            diffar och committar. Modellen kör via Ollama – koden lämnar aldrig datorn om du inte
            själv aktiverar en molntjänst. Bild, video och ljud kan du låta Gemini eller Grok göra,
            men bara efter att du slagit på molntjänster och godkänt det enskilda anropet.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/download/"
              className="rounded-md bg-ember px-5 py-2.5 text-sm font-semibold text-anvil hover:brightness-110"
            >
              Ladda ner Freevobe
            </Link>
            <Link href="/docs/" className="vf-card px-5 py-2.5 text-sm hover:border-iron">
              Läs dokumentationen
            </Link>
          </div>
          <p className="text-xs text-slate-500">
            Ingen telemetri. Ingen inloggning. Ingen molnkonto krävs. Sponsorplatsen i chatten är
            avstängd tills du säger ja.
          </p>
        </div>

        <div className="vf-card p-5">
          <p className="mb-3 text-xs tracking-wide text-slate-500 uppercase">
            Fungerande vertikal skiva
          </p>
          <ol className="space-y-2">
            {SLICE.map((step, index) => (
              <li key={step} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-ember/50 text-[11px] text-ember">
                  {index + 1}
                </span>
                <span className="text-slate-300">{step}</span>
              </li>
            ))}
          </ol>
          <pre className="mt-4 overflow-x-auto rounded-md border border-steel bg-anvil p-3 font-mono text-[11px] text-slate-400">
            {`$ npm run dev\nagent redo  ·  http://127.0.0.1:4319\ndiff  src/greet.ts  +6 −1  (väntar på godkännande)`}
          </pre>
        </div>
      </section>

      <GivesBackSlot />

      <section className="space-y-5">
        <h2 className="text-2xl font-semibold">Allt agenten behöver – lokalt</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <article key={feature.title} className="vf-card p-5">
              <h3 className="text-sm font-semibold text-slate-100">{feature.title}</h3>
              <p className="mt-2 text-[13px] text-slate-400">{feature.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Ett gränssnitt som följer dig</h2>
          <p className="max-w-2xl text-[13.5px] text-slate-400">
            Ljust eller mörkt, följ systemet eller växla manuellt. Tre vylägen reglerar hur mycket
            av agentens arbete som syns, och Qoder-läget ger en terminal-lik yta för den som vill
            köra allt från tangentbordet.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <article className="vf-card p-5">
            <h3 className="text-sm font-semibold text-slate-100">Ljust och mörkt</h3>
            <p className="mt-2 text-[13px] text-slate-400">
              Följer systemet tills du väljer. Valet sparas på datorn och gäller chatten, koden,
              previewn och Control Room.
            </p>
            <div className="mt-3 flex gap-2">
              <span className="h-6 flex-1 rounded border border-steel bg-white" />
              <span className="h-6 flex-1 rounded border border-steel bg-anvil" />
            </div>
          </article>
          <article className="vf-card p-5">
            <h3 className="text-sm font-semibold text-slate-100">Verbose · Normal · Summary</h3>
            <p className="mt-2 text-[13px] text-slate-400">
              Diala in hur mycket verktygsanrop och resonemang som visas – från full insyn till bara
              svaren.
            </p>
            <p className="mt-3 font-mono text-[11px] text-ember">V · N · S</p>
          </article>
          <article className="vf-card p-5">
            <h3 className="text-sm font-semibold text-slate-100">Qoder-läge</h3>
            <p className="mt-2 text-[13px] text-slate-400">
              Monospace, minimal krom och kommandon som <code>:w</code>, <code>:q</code> och{' '}
              <code>:test</code> i paletten. Allt går att göra utan mus.
            </p>
          </article>
        </div>
        <pre className="overflow-x-auto rounded-md border border-steel bg-anvil p-4 font-mono text-[11.5px] text-slate-400">
          {`$ :run\npreview  http://127.0.0.1:5173  ·  redo\n$ :test\n12 gröna  ·  0 röda`}
        </pre>
      </section>

      <section className="vf-card space-y-4 p-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold">Från prompt till färdig fil</h2>
          <p className="max-w-2xl text-[13.5px] text-slate-400">
            Samma godkännande och samma granskning som för kod – men resultatet är en bild, en video
            eller ett ljud. Inget går till en molntjänst förrän du slagit på det och sagt ja till
            just det anropet.
          </p>
        </div>
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {MEDIA_STEPS.map((step, index) => (
            <li
              key={step}
              className="rounded-md border border-steel p-3 text-[13px] text-slate-300"
            >
              <span className="mr-2 font-mono text-[11px] text-ember">{index + 1}</span>
              {step}
            </li>
          ))}
        </ol>
        <p className="text-[12px] text-slate-500">
          Filen hamnar i <code className="font-mono text-slate-300">.freevobe/media/</code> med
          provider, modell, prompt och kostnad i en metadatafil – aldrig med din nyckel. Vill du se
          hela kedjan står den i{' '}
          <Link href="/docs/#media-flows" className="text-spark hover:text-ember">
            dokumentationen
          </Link>
          .
        </p>
      </section>

      <section className="space-y-5">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-semibold">Färdiga skills att utgå från</h2>
          <Link href="/skills/" className="text-sm text-ember hover:underline">
            Se alla skills →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {GALLERY_SKILLS.slice(0, 6).map((skill) => (
            <article key={skill.name} className="vf-card p-4">
              <p className="font-mono text-xs text-ember">{skill.name}</p>
              <p className="mt-1.5 text-[13px] text-slate-400">{skill.description}</p>
              <p className="mt-2 text-[11px] text-slate-600">
                triggers: {skill.triggers.join(', ')}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-semibold">Från bloggen</h2>
          <Link href="/blog/" className="text-sm text-ember hover:underline">
            Alla inlägg →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {BLOG_POSTS.map((post) => (
            <article key={post.slug} className="vf-card p-4">
              <p className="text-[11px] text-slate-600">{post.date}</p>
              <h3 className="mt-1 text-sm font-semibold text-slate-100">
                <Link href={`/blog/${post.slug}/`} className="hover:text-ember">
                  {post.title}
                </Link>
              </h3>
              <p className="mt-1.5 text-[13px] text-slate-400">{post.summary}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
