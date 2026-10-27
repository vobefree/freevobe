import type { Metadata } from "next";

import { UnderConstruction } from "@/components/under-construction";
import { ACTIVITIES, SAFETY_RULES } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Hitta kompanjon",
  description:
    "Boka en verifierad person för platoniskt sällskap: fika, promenad, konsert, middag eller evenemang.",
};

export default function CompanionsPage() {
  return (
    <UnderConstruction
      title="Hitta kompanjon"
      lead="Boka en verifierad människa för platoniskt sällskap – i din stad, i din takt."
      nextStep="Sök, filter och annonssidor kopplas in i steg 3. Bokningsflödet med Stripe test mode kommer i steg 5."
      points={[
        `Aktiviteter du kan filtrera på: ${ACTIVITIES.slice(0, 8).map((a) => a.label.toLowerCase()).join(", ")} med flera.`,
        "Filtrera på stad, aktivitet, språk, pris och datum. Komfortnivå 1–5 hjälper dig hitta någon som matchar din takt.",
        "Totalpriset visas alltid innan betalning: kompanjörens pris + 10 % serviceavgift.",
        ...SAFETY_RULES.slice(0, 3),
      ]}
    />
  );
}
