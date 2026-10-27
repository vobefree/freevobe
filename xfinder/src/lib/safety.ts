/**
 * Säkerhet i AI-coachen.
 *
 * Om en användare ger uttryck för akut kris eller självmordstankar ska coachen
 * omedelbart lämna övningen, visa hjälpinformation och uppmana till kontakt med
 * vården. Den ska aldrig försöka hantera krisen själv och aldrig ge medicinsk
 * rådgivning.
 */

export const CRISIS_RESOURCES = [
  {
    label: "112 – vid akut fara",
    description: "Ring 112 om du eller någon annan är i omedelbar fara just nu.",
    href: "tel:112",
  },
  {
    label: "1177 – sjukvårdsrådgivning",
    description: "Ring 1177 eller läs på 1177.se för att prata med sjukvården.",
    href: "https://www.1177.se/",
  },
  {
    label: "Din vårdcentral",
    description: "Kontakta din vårdcentral och be om ett samtal – du behöver inte veta exakt vad du ska säga.",
    href: "https://www.1177.se/hitta-vard/",
  },
  {
    label: "Mind Självmordslinjen",
    description: "Chatt och telefon dygnet runt på mind.se.",
    href: "https://mind.se/hitta-hjalp/sjalvmordslinjen/",
  },
] as const;

/**
 * Enkel nyckelordsdetektering som körs innan modellen svarar. Den fångar bara
 * uppenbara fall – modellen får en egen instruktion att också larma, och
 * resultatet sparas som crisis_flagged på samtalet.
 */
const CRISIS_PATTERNS: RegExp[] = [
  /\b(ta mitt liv|ta livet av (mig|mej)|sjalvmord|självmord|suicid)\w*/i,
  /\b(vill (inte|ej) leva|orkar inte leva|vill dö|önskar jag var död)\b/i,
  /\b(skada (mig|mej) själv|skär (mig|mej)|selfharm)\b/i,
  /\b(mår så dåligt att jag inte orkar mer|ingen anledning att leva)\b/i,
  /\b(akut kris|panikattack och vill inte leva)\b/i,
];

export function detectCrisis(text: string): boolean {
  return CRISIS_PATTERNS.some((pattern) => pattern.test(text));
}

/** Texten coachen svarar med vid misstänkt kris. Aldrig medicinsk rådgivning. */
export const CRISIS_REPLY = `Jag stannar här en stund. Det du berättar låter väldigt tungt, och du ska inte behöva bära det ensam.

Jag är en AI och kan inte hjälpa dig i en akut situation, men en människa kan:

- Är du i omedelbar fara just nu, ring **112**.
- Ring **1177** för sjukvårdsrådgivning dygnet runt.
- Kontakta din **vårdcentral** och be om ett samtal – du behöver inte veta exakt vad du ska säga.

Vill du att vi pratar vidare om något mindre, så finns jag kvar. Vi kan också bara sitta tysta en stund.`;

/** Påminnelsen när dagens gräns för AI-samtalet är nådd. */
export const PAUSE_MESSAGE = `Vi har pratat en hel del idag, och det är bra. Nu är en lagom tid att pausa.

Prova att göra en av de små sakerna vi pratade om – även om det bara är att säga hej till någon. Jag finns här igen imorgon.`;

export const AI_DISCLAIMER =
  "Jag är en AI-coach, inte en människa och inte vården. Jag kan hjälpa dig att öva och förbereda, men inte ställa diagnoser eller ge medicinsk rådgivning.";
