import Link from "next/link";
import { CalendarCheck, MessageCircleHeart, ShieldCheck, Users } from "lucide-react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { POSITIONING, SAFETY_RULES } from "@/lib/constants";
import { isSupabaseConfigured } from "@/lib/env";
import { REGISTRATION_FEE_SEK } from "@/lib/pricing";

const STEPS = [
  {
    title: "1. Öva först",
    text: "Prata med AI-coachen om småprat, jobbfesten eller samtalet du gruvar dig för.",
  },
  {
    title: "2. Bestäm ett litet steg",
    text: "Coachen föreslår något som går att göra på riktigt – ofta samma vecka.",
  },
  {
    title: "3. Boka sällskap",
    text: "Välj en verifierad kompanjör, tid och aktivitet. Totalpriset visas innan du betalar.",
  },
];

export default function Home() {
  const configured = isSupabaseConfigured();

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:py-14">
        {!configured && (
          <Alert variant="warning" className="mb-8">
            <ShieldCheck />
            <div>
              <AlertTitle>Databasen är inte inkopplad än</AlertTitle>
              <AlertDescription>
                Lägg in dina Supabase-nycklar i <code>.env.local</code> för att komma vidare.{" "}
                <Link href="/status" className="underline underline-offset-4">
                  Se systemstatus
                </Link>
                .
              </AlertDescription>
            </div>
          </Alert>
        )}

        <section className="max-w-2xl">
          <p className="text-sm font-medium text-primary">{POSITIONING.is}</p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Sällskap och social träning i din egen takt
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Xfinder är för dig som tycker att det sociala är svårare än det ser ut. Öva på
            samtal i lugn och ro, och boka en verifierad person när du vill ha sällskap på
            riktigt – en fika, en promenad, en konsert eller en middag.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/ai">Öva med AI</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/kompanjor">Hitta kompanjon</Link>
            </Button>
            <Button asChild size="lg" variant="ghost">
              <Link href="/status">Boka tid – så går det till</Link>
            </Button>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            Uppstart {REGISTRATION_FEE_SEK} kr engångsavgift (spamfilter). Sedan kostar varje
            bokning kompanjörens pris + 10 % serviceavgift. Alltid platoniskt.
          </p>
        </section>

        <section className="mt-12 grid gap-5 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <MessageCircleHeart className="size-5 text-primary" aria-hidden />
              <CardTitle>{POSITIONING.pillar1.title}</CardTitle>
              <CardDescription>{POSITIONING.pillar1.description}</CardDescription>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              Övningar i småprat, första mötet, jobbfest, bröllop, konflikt och gränssättning.
              Coachen tar en fråga i taget och är alltid tydlig med att den är en AI.
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Users className="size-5 text-primary" aria-hidden />
              <CardTitle>{POSITIONING.pillar2.title}</CardTitle>
              <CardDescription>{POSITIONING.pillar2.description}</CardDescription>
            </CardHeader>
            <CardContent className="text-muted-foreground">
              Filtrera på stad, aktivitet, språk, pris och datum. Ser du en bokning som passar
              visas hela priset innan du betalar.
            </CardContent>
          </Card>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold tracking-tight">Så fungerar det</h2>
          <ol className="mt-5 grid gap-4 sm:grid-cols-3">
            {STEPS.map((step) => (
              <li key={step.title} className="rounded-2xl border border-border bg-card p-5">
                <p className="font-medium">{step.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-12 grid gap-5 sm:grid-cols-2">
          <Card className="bg-secondary/50">
            <CardHeader>
              <CardTitle>Det här är vi inte</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-muted-foreground">
                {POSITIONING.isNot.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span aria-hidden>–</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <ShieldCheck className="size-5 text-primary" aria-hidden />
              <CardTitle>Trygghet före allt annat</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-muted-foreground">
                {SAFETY_RULES.slice(0, 4).map((rule) => (
                  <li key={rule} className="flex gap-2">
                    <CalendarCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
