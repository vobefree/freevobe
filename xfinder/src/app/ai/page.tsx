import type { Metadata } from "next";

import { UnderConstruction } from "@/components/under-construction";
import { AI_EXERCISES } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Öva med AI",
  description:
    "Träna småprat, första mötet, jobbfest, bröllop, konflikt och gränssättning med en svensk AI-coach.",
};

export default function AiPage() {
  return (
    <UnderConstruction
      title="Öva med AI"
      lead="En social coach som pratar svenska, tar en fråga i taget och hjälper dig hitta ett litet steg som går att göra på riktigt."
      nextStep="Textchatten, övningarna och röstläget kopplas in i steg 4 i byggplanen."
      points={[
        ...AI_EXERCISES.map((exercise) => `${exercise.label}: ${exercise.description}`),
        "Coachen är alltid tydlig med att den är en AI och lovar aldrig romantik, sex eller att vara en riktig person.",
        "Efter varje samtal föreslår coachen ett litet verkligt nästa steg och du får en vänlig pauspåminnelse när dagens gräns är nådd.",
      ]}
    />
  );
}
