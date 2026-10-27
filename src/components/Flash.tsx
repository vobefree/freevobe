const MESSAGES: Record<string, string> = {
  "an-ny": "Anställd tillagd.",
  "an-oppd": "Ändringarna är sparade.",
  "an-bort": "Den anställda togs bort.",
  "an-fel": "Kontrollera uppgifterna – namn, användarnamn och PIN (4–8 siffror) krävs.",
  "an-dubblett": "Användarnamnet finns redan. Välj ett annat.",
  "an-pin": "PIN måste vara 4–8 siffror.",
  "pass-ny": "Passet är schemalagt.",
  "pass-bort": "Passet togs bort.",
  "pass-fel": "Kontrollera passuppgifterna – datum och tider måste fyllas i.",
  "in": "Du är inklockad. Ha en bra dag!",
  "out": "Du är utcheckad – tack för idag!",
  "redan": "Du redan inklockad.",
  "ej-in": "Du är inte inklockad just nu.",
  "fel": "Något gick fel. Försök igen.",
};

export default function Flash({ code }: { code?: string }) {
  if (!code) return null;
  const text = MESSAGES[code];
  if (!text) return null;
  const ok = ["an-ny", "an-oppd", "an-bort", "pass-ny", "pass-bort", "in", "out"].includes(code);
  return <div className={`notice ${ok ? "ok" : "error"}`}>{text}</div>;
}
