/**
 * Annonsplats för AdSense – förberedd men avstängd.
 *
 * Sidan är byggd så att en annons kan slås på utan att röra layouten:
 *  1. Sätt `NEXT_PUBLIC_ADSENSE_CLIENT` (t.ex. `ca-pub-1234567890123456`) i miljön.
 *  2. Lägg in script-taggen `<Script src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=...">`
 *     i `layout.tsx` (med `strategy="afterInteractive"`) – den är medvetet inte inlagd ännu.
 *
 * Tills dess returnerar komponenten null, så ingen annonskod, inga cookies och ingen layoutskift
 * hamnar i den publika versionen. Platsen har en fast minsta höjd när den är på, så att CLS
 * förblir noll även med annons.
 */
const CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
const SLOT_ID = process.env.NEXT_PUBLIC_ADSENSE_SLOT;

export function AdSlot() {
  if (!CLIENT || !SLOT_ID) return null;
  if (process.env.NODE_ENV !== 'production') return null;

  return (
    <aside
      aria-label="Advertisement"
      className="vf-shell py-10"
      data-ad-client={CLIENT}
      data-ad-slot={SLOT_ID}
    >
      <p className="mb-2 text-center text-[10px] tracking-[0.18em] text-muted uppercase">
        Advertisement
      </p>
      {/* Reserverad höjd = ingen layoutförskjutning när annonsen laddas. */}
      <div className="min-h-[100px] w-full rounded-xl border border-dashed border-line-strong" />
    </aside>
  );
}
