import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border/70 bg-card/60">
      <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-10 sm:grid-cols-2">
        <div className="space-y-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Xfinder (arbetsnamn – byter namn före lansering)</p>
          <p className="leading-relaxed">
            Platoniskt sällskap och social träning. Ingen dejting, ingen escorttjänst,
            ingen sexuell tjänst och ingen fysisk intimitet.
          </p>
          <p className="leading-relaxed">
            AI-coachen är en AI och utger sig aldrig för att vara en människa.
          </p>
        </div>

        <div className="space-y-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Om det gör ont på riktigt</p>
          <p className="leading-relaxed">
            Är du i akut fara, ring <strong className="text-foreground">112</strong>. För
            sjukvårdsrådgivning, ring <strong className="text-foreground">1177</strong> eller
            kontakta din vårdcentral.
          </p>
          <nav className="flex flex-wrap gap-4">
            <Link href="/status" className="underline underline-offset-4">
              Systemstatus
            </Link>
            <Link href="/kompanjor" className="underline underline-offset-4">
              Kompanjörer
            </Link>
            <Link href="/ai" className="underline underline-offset-4">
              AI-coachen
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
