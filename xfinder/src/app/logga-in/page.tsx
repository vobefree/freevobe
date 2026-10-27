import type { Metadata } from "next";

import { UnderConstruction } from "@/components/under-construction";
import { REGISTRATION_FEE_SEK } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Logga in",
  description: "Logga in eller skapa ett konto hos Xfinder.",
};

export default function LoginPage() {
  return (
    <UnderConstruction
      title="Logga in eller skapa konto"
      lead="Inloggningen sker med e-postlänk – inget lösenord att hålla reda på."
      nextStep="Supabase Auth, profiler och onboarding kopplas in i steg 2."
      points={[
        "Du loggar in med en magisk länk som skickas till din e-post.",
        `Uppstartsavgiften är ${REGISTRATION_FEE_SEK} kr en gång, som spamfilter. AI-coachen går att prova innan dess.`,
        "Vi frågar bara efter det som behövs: namn, stad, intressen, språk och hur stora sociala steg du vill ta.",
      ]}
    />
  );
}
