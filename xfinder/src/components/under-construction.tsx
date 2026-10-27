import Link from "next/link";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function UnderConstruction({
  title,
  lead,
  points,
  nextStep,
}: {
  title: string;
  lead: string;
  points: string[];
  nextStep: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:py-14">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">{lead}</p>

        <Alert variant="info" className="mt-6">
          <AlertTitle>Den här sidan byggs i nästa steg</AlertTitle>
          <AlertDescription>{nextStep}</AlertDescription>
        </Alert>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Så kommer det att fungera</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5 text-muted-foreground">
              {points.map((point) => (
                <li key={point} className="flex gap-2.5">
                  <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="mt-7 flex flex-wrap gap-3">
          <Button asChild variant="outline">
            <Link href="/">Till startsidan</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/status">Systemstatus</Link>
          </Button>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
