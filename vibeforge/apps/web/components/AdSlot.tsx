/**
 * Reserverad annonsplats på den publika sajten.
 *
 * AdSense laddas bara om NEXT_PUBLIC_ADSENSE_CLIENT är satt vid bygget, och skriptet körs
 * aldrig i skrivbordsappens chatt. Platsen är alltid tydligt märkt och visar en neutral
 * platshållare när ingen annonsleverantör är konfigurerad.
 */
export function AdSlot({
  label = 'Annonsutrymme',
  format = 'horizontal',
}: {
  label?: string;
  format?: 'horizontal' | 'square';
}) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const slot = process.env.NEXT_PUBLIC_ADSENSE_SLOT;

  return (
    <aside aria-label="Annons" className="vf-ad my-6 p-4">
      <p className="mb-2 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
        {label}
      </p>
      {client && slot ? (
        <ins
          className="adsbygoogle block"
          style={{ display: 'block', minHeight: format === 'square' ? 250 : 90 }}
          data-ad-client={client}
          data-ad-slot={slot}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      ) : (
        <p className="text-xs text-slate-500">
          Ingen annonsleverantör är konfigurerad. Sätt{' '}
          <code className="font-mono">NEXT_PUBLIC_ADSENSE_CLIENT</code> och{' '}
          <code className="font-mono">NEXT_PUBLIC_ADSENSE_SLOT</code> vid bygget för att aktivera
          AdSense här. Inga besökardata skickas någonstans så länge de är tomma.
        </p>
      )}
    </aside>
  );
}
