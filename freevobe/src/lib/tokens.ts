/**
 * Ytor som återkommer i flera sektioner. Hålls här i stället för att kopieras som klasssträngar,
 * så att panelerna inte glider isär när designen justeras.
 */
export function card() {
  return 'vf-panel relative h-full p-6 transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-accent/45';
}

export function eyebrow() {
  return 'text-xs font-semibold tracking-[0.16em] text-accent-soft uppercase';
}

export function sectionTitle() {
  return 'mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-[2.6rem]';
}
