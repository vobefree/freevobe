import type { Metadata } from "next";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CORE_TABLES, MIGRATIONS, type CoreTable } from "@/lib/migrations";
import { isSupabaseConfigured, missingPublicSupabaseKeys } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import {
  FIRST_BOOKING_FEE_SEK,
  REGISTRATION_FEE_SEK,
  SERVICE_FEE_RATE,
  formatSek,
} from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Systemstatus",
  description: "Kontroll av databas, RLS-migreringar och prisregler.",
};

export const dynamic = "force-dynamic";

type TableCheck = { table: CoreTable; ok: boolean; detail: string };

async function checkTables(): Promise<{ checks: TableCheck[]; account: string }> {
  const supabase = await createClient();

  const checks = await Promise.all(
    CORE_TABLES.map(async (table): Promise<TableCheck> => {
      const { error } = await supabase.from(table).select("*", { count: "exact", head: true });

      return {
        table,
        ok: !error,
        detail: error
          ? `${error.code ?? "fel"}: ${error.message}`
          : "nås (RLS filtrerar raderna)",
      };
    }),
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let account = "Inte inloggad";

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, role, registration_paid_at")
      .eq("id", user.id)
      .maybeSingle();

    account = profile
      ? `${profile.display_name} (${profile.role}) – uppstartsavgift ${
          profile.registration_paid_at ? "betald" : "inte betald"
        }`
      : `${user.email ?? user.id} – ingen profilrad hittades`;
  }

  return { checks, account };
}

export default async function StatusPage() {
  const configured = isSupabaseConfigured();
  const missing = missingPublicSupabaseKeys();

  let data: { checks: TableCheck[]; account: string } | null = null;
  let failure: string | null = null;

  if (configured) {
    try {
      data = await checkTables();
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    }
  }

  const allTablesOk = data?.checks.every((check) => check.ok) ?? false;

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:py-14">
        <h1 className="text-3xl font-semibold tracking-tight">Systemstatus</h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          Kontroll av att databasen svarar, att tabellerna finns och att prisreglerna är de
          som gäller. Inget här kräver inloggning.
        </p>

        {!configured && (
          <Alert variant="warning" className="mt-6">
            <AlertTitle>Supabase är inte inkopplat än</AlertTitle>
            <AlertDescription>
              <p>
                Skapa <code>.env.local</code> i projektmappen och fyll i:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {missing.map((key) => (
                  <li key={key}>
                    <code>{key}</code>
                  </li>
                ))}
                <li>
                  <code>SUPABASE_SERVICE_ROLE_KEY</code> (endast server, behövs för webhooks)
                </li>
              </ul>
              <p className="mt-2">
                Se <code>.env.example</code> för alla variabler. Starta om <code>npm run dev</code>{" "}
                efteråt.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {failure && (
          <Alert variant="destructive" className="mt-6">
            <AlertTitle>Kunde inte nå databasen</AlertTitle>
            <AlertDescription>{failure}</AlertDescription>
          </Alert>
        )}

        {data && (
          <>
            <Alert variant={allTablesOk ? "info" : "destructive"} className="mt-6">
              <AlertTitle>
                {allTablesOk
                  ? "Databasen svarar och alla tabeller finns"
                  : "Databasen svarar men något saknas"}
              </AlertTitle>
              <AlertDescription>
                Inloggat konto: {data.account}
              </AlertDescription>
            </Alert>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Tabeller</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-border">
                  {data.checks.map((check) => (
                    <li key={check.table} className="flex items-center justify-between gap-3 py-2.5">
                      <code className="text-xs sm:text-sm">{check.table}</code>
                      <span className="flex items-center gap-2 text-right text-xs text-muted-foreground">
                        <span className="hidden sm:inline">{check.detail}</span>
                        <Badge variant={check.ok ? "default" : "destructive"}>
                          {check.ok ? "OK" : "Fel"}
                        </Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </>
        )}

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Migreringar</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-4">
              {MIGRATIONS.map((migration) => (
                <li key={migration.file}>
                  <p className="font-medium">{migration.title}</p>
                  <p className="text-xs text-muted-foreground">
                    <code>supabase/migrations/{migration.file}</code>
                  </p>
                  <p className="mt-1 text-muted-foreground">{migration.description}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Prisregler</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-muted-foreground">
              <li>Uppstartsavgift: {formatSek(REGISTRATION_FEE_SEK)} engångs (spamfilter).</li>
              <li>Första bokningen: {formatSek(FIRST_BOOKING_FEE_SEK)} engångs.</li>
              <li>Serviceavgift: {SERVICE_FEE_RATE * 100} % av kompanjörens belopp.</li>
              <li>
                Totalpriset visas alltid före betalning och låses i databasen, så att klienten
                inte kan skicka ett eget pris.
              </li>
            </ul>
          </CardContent>
        </Card>
      </main>

      <SiteFooter />
    </div>
  );
}
