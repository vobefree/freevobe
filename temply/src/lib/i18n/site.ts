import type { Locale } from "@/lib/theme/types";

/**
 * Texter för det som ligger utanför själva studion: varumärkesnotis, fotens
 * betalningsinformation, kontaktsidan, cookiebannern och de juridiska sidorna.
 * Hålls i en egen modul eftersom de är betydligt längre än gränssnittets etiketter.
 */

export type LegalSection = { title: string; body: string };

export type LegalDoc = {
  title: string;
  eyebrow: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
  footerNote: string;
};

export type SiteCopy = {
  trademark: string;
  stripe: { note: string; link: string };
  contact: {
    eyebrow: string;
    title: string;
    sub: string;
    name: string;
    email: string;
    subject: string;
    message: string;
    send: string;
    sending: string;
    success: string;
    error: string;
    required: string;
    asideTitle: string;
    asideText: string;
    responseTime: string;
    emailLabel: string;
    faqTitle: string;
    faq: { q: string; a: string }[];
  };
  cookie: {
    badge: string;
    title: string;
    body: string;
    accept: string;
    essential: string;
    learnMore: string;
    saved: string;
  };
  terms: LegalDoc;
  privacy: LegalDoc;
};

const en: SiteCopy = {
  trademark:
    "All trademarks belong to their respective owners. We are not affiliated with, or endorsed by, these companies.",
  stripe: { note: "Payments are handled by Stripe. Card details never touch our servers.", link: "How billing works" },
  contact: {
    eyebrow: "Contact",
    title: "Say hello to a human.",
    sub: "Questions about the studio, a theme that looks off, or an invoice that needs a friend? Write to us — a real person answers, usually within a day.",
    name: "Your name",
    email: "Email",
    subject: "Subject",
    message: "Message",
    send: "Send message",
    sending: "Sending…",
    success: "Got it! We'll reply to your inbox, not to a robot.",
    error: "The message didn't get through. Try again, or email us directly.",
    required: "Please fill in your name, email and message.",
    asideTitle: "Prefer email?",
    asideText: "We read everything, even the long ones. Add a screenshot if something looks broken.",
    responseTime: "Usually answered within one business day.",
    emailLabel: "Email us",
    faqTitle: "Before you write",
    faq: [
      { q: "Can I cancel myself?", a: "Yes — one click in the dashboard. No email, no guilt trip." },
      { q: "Do you offer refunds?", a: "Within 14 days of a charge, if you haven't published a theme. Just ask." },
      { q: "Something looks broken.", a: "Tell us which theme, which browser and what you expected. That's usually enough." },
    ],
  },
  cookie: {
    badge: "A small, friendly notice",
    title: "We don't bake cookies. We build themes.",
    body: "But a few tiny ones keep you signed in, remember your language and hide this box. No advertisers, no calories, no selling your data.",
    accept: "Yes, pass the cookies",
    essential: "Only the essentials",
    learnMore: "What we store",
    saved: "Saved. The cookie jar is closed.",
  },
  terms: {
    title: "Terms of Service",
    eyebrow: "The fine print, in plain language",
    updated: "Last updated 18 October 2026",
    intro:
      "These terms apply when you use ThemeFold — the browser studio for building, exporting and publishing Shopify themes. By creating an account you accept them.",
    sections: [
      {
        title: "1. The service",
        body: "ThemeFold is a subscription studio that runs in your browser. You can design, preview, export and publish Shopify themes. A Shopify store is only needed if you want to publish directly; building and exporting works without one.",
      },
      {
        title: "2. Your account",
        body: "You must be at least 16 years old, and 18 to pay for a subscription. Keep your login to yourself. You are responsible for activity on your account and for keeping your email address up to date.",
      },
      {
        title: "3. Trial, price and billing",
        body: "The first three days are free and require no card. After that the subscription costs the amount shown in your local currency at checkout (21 SEK per month in Sweden) and renews automatically every 30 days until you cancel.",
      },
      {
        title: "4. Cancelling and your right to change your mind",
        body: "You can cancel at any time from the dashboard; access continues until the paid period ends. Consumers in the EU have a 14-day right of withdrawal from the purchase. Email us and we'll sort it out without a fight.",
      },
      {
        title: "5. Your content and our content",
        body: "You own the text, images and themes you create. We own the service, its code, design and name. Logos shown in the integration strip belong to their respective owners and are used for reference only.",
      },
      {
        title: "6. Fair use",
        body: "Do not use ThemeFold for anything illegal, to attack the service, to resell access, or to copy the studio itself. Automated bulk use needs our written permission.",
      },
      {
        title: "7. Availability and liability",
        body: "We aim for 99.5% uptime but promise no flawless service. Our liability is limited to what you paid during the last twelve months, and we are not liable for indirect losses such as lost sales or lost data. Keep your own copies of exported themes.",
      },
      {
        title: "8. Changes",
        body: "We may update these terms as the service evolves. Material changes are announced by email at least 30 days before they apply, and continuing to use ThemeFold means you accept the new version.",
      },
      {
        title: "9. Law and contact",
        body: "Swedish law applies, and disputes are settled by a Swedish general court. Questions about these terms: hello@themefold.com.",
      },
    ],
    footerNote: "This summary is written to be readable, not to hide anything. The Swedish version is the authoritative one.",
  },
  privacy: {
    title: "Privacy Policy",
    eyebrow: "What we know, and why",
    updated: "Last updated 18 October 2026",
    intro:
      "ThemeFold needs a little information to build themes for you. This page explains exactly what we store, why, and how to get rid of it.",
    sections: [
      {
        title: "1. Who is responsible",
        body: "ThemeFold is the controller of the personal data described here. You can reach us at hello@themefold.com for any privacy question.",
      },
      {
        title: "2. What we collect",
        body: "Your name and email address, a password stored only as a hash, the themes and settings you create, your subscription status from Stripe, and technical logs such as IP address and browser when you use the service.",
      },
      {
        title: "3. Why we process it",
        body: "To deliver the service you signed up for (contract), to keep it secure and fix errors (legitimate interest), and — for optional cookies — with your consent. We do not profile you for advertising.",
      },
      {
        title: "4. Cookies",
        body: "We use strictly necessary cookies for your session, your chosen language and your cookie choice. No advertising or cross-site tracking cookies are set. You can change your choice by clearing the site data in your browser.",
      },
      {
        title: "5. Payments",
        body: "Card payments are handled by Stripe. We never see or store your card number. Stripe acts as our processor and may process data in the United States under the EU Standard Contractual Clauses.",
      },
      {
        title: "6. How long we keep it",
        body: "Account data is kept until you delete your account. Server logs are kept for 90 days. Accounting records are kept for seven years because Swedish law requires it.",
      },
      {
        title: "7. Your rights",
        body: "You have the right to access, correct, delete, restrict and export your data. Email us and we answer within 30 days. You can also complain to the Swedish Authority for Privacy Protection (IMY).",
      },
      {
        title: "8. Security",
        body: "Passwords are hashed, traffic is encrypted with HTTPS and access to personal data is limited to what is needed to run the service. If a breach affects you, we tell you and IMY within 72 hours.",
      },
      {
        title: "9. Changes",
        body: "If this policy changes in a way that matters, we say so in the service or by email before the change takes effect.",
      },
    ],
    footerNote: "We collect what we need to build themes — not a field more.",
  },
};

const sv: SiteCopy = {
  trademark:
    "Alla varumärken tillhör sina respektive ägare. Vi har ingen koppling till och är inte godkända av dessa företag.",
  stripe: { note: "Betalningen hanteras av Stripe. Dina kortuppgifter når aldrig våra servrar.", link: "Så funkar betalningen" },
  contact: {
    eyebrow: "Kontakt",
    title: "Säg hej till en människa.",
    sub: "Frågor om studion, ett tema som ser konstigt ut, eller en faktura som behöver en vän? Skriv till oss — en riktig person svarar, oftast samma dag.",
    name: "Ditt namn",
    email: "E-post",
    subject: "Ämne",
    message: "Meddelande",
    send: "Skicka meddelande",
    sending: "Skickar…",
    success: "Tack! Vi svarar i din inkorg, inte till en robot.",
    error: "Meddelandet kom inte fram. Försök igen eller mejla oss direkt.",
    required: "Fyll i namn, e-post och meddelande.",
    asideTitle: "Hellre mejl?",
    asideText: "Vi läser allt, även de långa. Bifoga en skärmbild om något ser trasigt ut.",
    responseTime: "Vi svarar oftast inom en arbetsdag.",
    emailLabel: "Mejla oss",
    faqTitle: "Innan du skriver",
    faq: [
      { q: "Kan jag avsluta själv?", a: "Ja — ett klick i instrumentpanelen. Ingen mejl, ingen skuldkänsla." },
      { q: "Får jag pengarna tillbaka?", a: "Inom 14 dagar från en debitering, om du inte publicerat ett tema. Fråga bara." },
      { q: "Något ser trasigt ut.", a: "Berätta vilket tema, vilken webbläsare och vad du förväntade dig. Det räcker oftast." },
    ],
  },
  cookie: {
    badge: "En liten, vänlig notis",
    title: "Vi bakar inte kakor. Vi bygger teman.",
    body: "Men några små behövs för att hålla dig inloggad, komma ihåg ditt språk och slippa se den här rutan igen. Inga annonsörer, inga kalorier, ingen data till salu.",
    accept: "Ja, ta mina kakor",
    essential: "Bara det nödvändiga",
    learnMore: "Vad vi lagrar",
    saved: "Sparat. Kakburken är stängd.",
  },
  terms: {
    title: "Villkor",
    eyebrow: "Det finstilta, på vanlig svenska",
    updated: "Senast uppdaterad 18 oktober 2026",
    intro:
      "De här villkoren gäller när du använder ThemeFold — studion i webbläsaren för att bygga, exportera och publicera Shopify-teman. Genom att skapa ett konto godkänner du dem.",
    sections: [
      {
        title: "1. Tjänsten",
        body: "ThemeFold är en prenumerationsstudio som körs i din webbläsare. Du kan formge, förhandsvisa, exportera och publicera Shopify-teman. En Shopify-butik behövs bara om du vill publicera direkt; att bygga och exportera fungerar utan.",
      },
      {
        title: "2. Ditt konto",
        body: "Du måste vara minst 16 år, och 18 för att betala för en prenumeration. Håll inloggningen för dig själv. Du ansvarar för aktiviteten på kontot och för att din e-postadress stämmer.",
      },
      {
        title: "3. Provperiod, pris och betalning",
        body: "De första tre dagarna är gratis och kräver inget kort. Därefter kostar prenumerationen det belopp som visas i din lokala valuta i kassan (21 SEK per månad i Sverige) och förnyas automatiskt var 30:e dag tills du avslutar.",
      },
      {
        title: "4. Uppsägning och ångerrätt",
        body: "Du kan avsluta när som helst i instrumentpanelen; åtkomsten gäller perioden ut. Konsumenter i EU har 14 dagars ångerrätt från köpet. Mejla oss så löser vi det utan krångel.",
      },
      {
        title: "5. Ditt innehåll och vårt",
        body: "Du äger text, bilder och teman som du skapar. Vi äger tjänsten, koden, designen och namnet. Logotyperna i integrationsraden tillhör respektive företag och visas endast som hänvisning.",
      },
      {
        title: "6. Rimlig användning",
        body: "Använd inte ThemeFold för något olagligt, för att angripa tjänsten, sälja vidare åtkomst eller kopiera studion. Automatiserad massanvändning kräver vårt skriftliga tillstånd.",
      },
      {
        title: "7. Tillgänglighet och ansvar",
        body: "Vi siktar på 99,5 % drifttid men lovar ingen felfri tjänst. Vårt ansvar är begränsat till det du betalat de senaste tolv månaderna, och vi ansvarar inte för indirekta förluster som utebliven försäljning eller förlorad data. Spara egna kopior av exporterade teman.",
      },
      {
        title: "8. Ändringar",
        body: "Vi kan uppdatera villkoren när tjänsten utvecklas. Väsentliga ändringar aviseras via e-post minst 30 dagar innan de gäller, och om du fortsätter använda ThemeFold godkänner du den nya versionen.",
      },
      {
        title: "9. Lag och kontakt",
        body: "Svensk lag tillämpas och tvister avgörs av svensk allmän domstol. Frågor om villkoren: hej@themefold.com.",
      },
    ],
    footerNote: "Sammanfattningen är skriven för att gå att läsa, inte för att dölja något.",
  },
  privacy: {
    title: "Integritetspolicy",
    eyebrow: "Vad vi vet, och varför",
    updated: "Senast uppdaterad 18 oktober 2026",
    intro:
      "ThemeFold behöver lite information för att kunna bygga teman åt dig. Här står exakt vad vi sparar, varför, och hur du blir av med det.",
    sections: [
      {
        title: "1. Vem som ansvarar",
        body: "ThemeFold är personuppgiftsansvarig för uppgifterna som beskrivs här. Kontakta oss på hej@themefold.com i alla integritetsfrågor.",
      },
      {
        title: "2. Vad vi samlar in",
        body: "Namn och e-postadress, lösenord som endast lagras som hash, teman och inställningar du skapar, din prenumerationsstatus från Stripe samt tekniska loggar som IP-adress och webbläsare när du använder tjänsten.",
      },
      {
        title: "3. Varför vi behandlar dem",
        body: "För att leverera tjänsten du tecknat (avtal), för att hålla den säker och rätta fel (berättigat intresse) och — för valfria kakor — med ditt samtycke. Vi profilerar dig inte för annonsering.",
      },
      {
        title: "4. Kakor",
        body: "Vi använder nödvändiga kakor för sessionen, ditt språkval och ditt cookieval. Inga reklam- eller spårningskakor sätts. Du kan ändra ditt val genom att rensa webbplatsdata i webbläsaren.",
      },
      {
        title: "5. Betalningar",
        body: "Kortbetalningar hanteras av Stripe. Vi ser eller sparar aldrig ditt kortnummer. Stripe är vårt personuppgiftsbiträde och kan behandla uppgifter i USA enligt EU:s standardavtalsklausuler.",
      },
      {
        title: "6. Hur länge vi sparar",
        body: "Kontouppgifter sparas till du raderar kontot. Serverloggar sparas i 90 dagar. Bokföringsunderlag sparas i sju år eftersom svensk lag kräver det.",
      },
      {
        title: "7. Dina rättigheter",
        body: "Du har rätt att få tillgång till, rätta, radera, begränsa och exportera dina uppgifter. Mejla oss så svarar vi inom 30 dagar. Du kan också klaga hos Integritetsskyddsmyndigheten (IMY).",
      },
      {
        title: "8. Säkerhet",
        body: "Lösenord hashas, trafiken krypteras med HTTPS och åtkomsten till personuppgifter begränsas till det som behövs för driften. Vid ett intrång som påverkar dig meddelar vi dig och IMY inom 72 timmar.",
      },
      {
        title: "9. Ändringar",
        body: "Om policyn ändras på ett sätt som spelar roll säger vi till i tjänsten eller via e-post innan ändringen börjar gälla.",
      },
    ],
    footerNote: "Vi samlar in det vi behöver för att bygga teman — inte ett fält extra.",
  },
};

const nb: SiteCopy = {
  trademark:
    "Alle varemerker tilhører sine respektive eiere. Vi er ikke tilknyttet eller godkjent av disse selskapene.",
  stripe: { note: "Betalingen håndteres av Stripe. Kortopplysningene dine når aldri våre servere.", link: "Slik fungerer betalingen" },
  contact: {
    eyebrow: "Kontakt",
    title: "Si hei til et menneske.",
    sub: "Spørsmål om studioet, et tema som ser rart ut, eller en faktura som trenger en venn? Skriv til oss — en ekte person svarer, som regel samme dag.",
    name: "Navnet ditt",
    email: "E-post",
    subject: "Emne",
    message: "Melding",
    send: "Send melding",
    sending: "Sender…",
    success: "Takk! Vi svarer i innboksen din, ikke til en robot.",
    error: "Meldingen kom ikke frem. Prøv igjen, eller send oss en e-post direkte.",
    required: "Fyll inn navn, e-post og melding.",
    asideTitle: "Foretrekker du e-post?",
    asideText: "Vi leser alt, også de lange. Legg ved et skjermbilde hvis noe ser ødelagt ut.",
    responseTime: "Vi svarer vanligvis innen én arbeidsdag.",
    emailLabel: "Send oss e-post",
    faqTitle: "Før du skriver",
    faq: [
      { q: "Kan jeg avslutte selv?", a: "Ja — ett klikk i dashbordet. Ingen e-post, ingen dårlig samvittighet." },
      { q: "Får jeg pengene tilbake?", a: "Innen 14 dager etter en belastning, hvis du ikke har publisert et tema. Bare spør." },
      { q: "Noe ser ødelagt ut.", a: "Fortell hvilket tema, hvilken nettleser og hva du forventet. Det holder som regel." },
    ],
  },
  cookie: {
    badge: "Et lite, vennlig varsel",
    title: "Vi baker ikke kaker. Vi bygger temaer.",
    body: "Men noen små trengs for å holde deg innlogget, huske språket ditt og skjule denne boksen. Ingen annonsører, ingen kalorier, ingen data til salgs.",
    accept: "Ja, ta kakene mine",
    essential: "Bare det nødvendige",
    learnMore: "Hva vi lagrer",
    saved: "Lagret. Kakeboksen er lukket.",
  },
  terms: {
    title: "Vilkår",
    eyebrow: "Det finstilte, på vanlig norsk",
    updated: "Sist oppdatert 18. oktober 2026",
    intro:
      "Disse vilkårene gjelder når du bruker ThemeFold — studioet i nettleseren for å bygge, eksportere og publisere Shopify-temaer. Ved å opprette en konto godtar du dem.",
    sections: [
      { title: "1. Tjenesten", body: "ThemeFold er et abonnementsstudio som kjører i nettleseren din. Du kan formgi, forhåndsvise, eksportere og publisere Shopify-temaer. En Shopify-butikk trengs bare hvis du vil publisere direkte; bygging og eksport fungerer uten." },
      { title: "2. Kontoen din", body: "Du må være minst 16 år, og 18 for å betale for et abonnement. Hold innloggingen for deg selv. Du er ansvarlig for aktiviteten på kontoen og for at e-postadressen er oppdatert." },
      { title: "3. Prøveperiode, pris og betaling", body: "De tre første dagene er gratis og krever ikke kort. Deretter koster abonnementet beløpet som vises i din lokale valuta i kassen (22 NOK per måned i Norge) og fornyes automatisk hver 30. dag til du avslutter." },
      { title: "4. Oppsigelse og angrerett", body: "Du kan avslutte når som helst i dashbordet; tilgangen varer perioden ut. Forbrukere i EU har 14 dagers angrerett fra kjøpet. Send oss en e-post, så ordner vi det uten krangel." },
      { title: "5. Ditt innhold og vårt", body: "Du eier tekst, bilder og temaer du lager. Vi eier tjenesten, koden, designet og navnet. Logoene i integrasjonsraden tilhører sine respektive eiere og vises bare som referanse." },
      { title: "6. Rimelig bruk", body: "Ikke bruk ThemeFold til noe ulovlig, til å angripe tjenesten, videreselge tilgang eller kopiere studioet. Automatisert massebruk krever vår skriftlige tillatelse." },
      { title: "7. Tilgjengelighet og ansvar", body: "Vi sikter på 99,5 % oppetid, men lover ingen feilfri tjeneste. Ansvaret vårt er begrenset til det du betalte de siste tolv månedene, og vi er ikke ansvarlige for indirekte tap som tapt salg eller tapt data. Ta egne kopier av eksporterte temaer." },
      { title: "8. Endringer", body: "Vi kan oppdatere vilkårene når tjenesten utvikles. Vesentlige endringer varsles på e-post minst 30 dager før de gjelder, og hvis du fortsetter å bruke ThemeFold godtar du den nye versjonen." },
      { title: "9. Lov og kontakt", body: "Norsk lov gjelder, og tvister avgjøres av norsk alminnelig domstol. Spørsmål om vilkårene: hei@themefold.com." },
    ],
    footerNote: "Sammendraget er skrevet for å være lesbart, ikke for å skjule noe.",
  },
  privacy: {
    title: "Personvernerklæring",
    eyebrow: "Hva vi vet, og hvorfor",
    updated: "Sist oppdatert 18. oktober 2026",
    intro:
      "ThemeFold trenger litt informasjon for å bygge temaer for deg. Her står nøyaktig hva vi lagrer, hvorfor, og hvordan du blir kvitt det.",
    sections: [
      { title: "1. Hvem som er ansvarlig", body: "ThemeFold er behandlingsansvarlig for opplysningene som beskrives her. Kontakt oss på hei@themefold.com i alle personvernspørsmål." },
      { title: "2. Hva vi samler inn", body: "Navn og e-postadresse, passord som bare lagres som hash, temaene og innstillingene du lager, abonnementsstatusen din fra Stripe, og tekniske logger som IP-adresse og nettleser når du bruker tjenesten." },
      { title: "3. Hvorfor vi behandler dem", body: "For å levere tjenesten du har tegnet (avtale), holde den sikker og rette feil (berettiget interesse) og — for valgfrie kaker — med ditt samtykke. Vi profilerer deg ikke for annonsering." },
      { title: "4. Kaker", body: "Vi bruker nødvendige kaker for sesjonen, språkvalget og kakevalget ditt. Ingen reklame- eller sporingskaker settes. Du kan endre valget ved å slette nettsteddata i nettleseren." },
      { title: "5. Betalinger", body: "Kortbetalinger håndteres av Stripe. Vi ser eller lagrer aldri kortnummeret ditt. Stripe er vår databehandler og kan behandle data i USA etter EUs standardvilkår." },
      { title: "6. Hvor lenge vi lagrer", body: "Kontoopplysninger lagres til du sletter kontoen. Serverlogger lagres i 90 dager. Regnskapsmateriale lagres i sju år fordi norsk lov krever det." },
      { title: "7. Rettighetene dine", body: "Du har rett til innsyn, retting, sletting, begrensning og eksport av opplysningene dine. Send oss en e-post, så svarer vi innen 30 dager. Du kan også klage til Datatilsynet." },
      { title: "8. Sikkerhet", body: "Passord hashes, trafikken krypteres med HTTPS og tilgangen til personopplysninger begrenses til det driften krever. Ved et brudd som rammer deg varsler vi deg og Datatilsynet innen 72 timer." },
      { title: "9. Endringer", body: "Hvis erklæringen endres på en måte som betyr noe, sier vi fra i tjenesten eller på e-post før endringen gjelder." },
    ],
    footerNote: "Vi samler inn det vi trenger for å bygge temaer — ikke ett felt mer.",
  },
};

const da: SiteCopy = {
  trademark:
    "Alle varemærker tilhører deres respektive ejere. Vi er ikke tilknyttet eller godkendt af disse virksomheder.",
  stripe: { note: "Betalingen håndteres af Stripe. Dine kortoplysninger når aldrig vores servere.", link: "Sådan fungerer betalingen" },
  contact: {
    eyebrow: "Kontakt",
    title: "Sig hej til et menneske.",
    sub: "Spørgsmål om studiet, et tema der ser mærkeligt ud, eller en faktura der trænger til en ven? Skriv til os — et rigtigt menneske svarer, oftest samme dag.",
    name: "Dit navn",
    email: "E-mail",
    subject: "Emne",
    message: "Besked",
    send: "Send besked",
    sending: "Sender…",
    success: "Tak! Vi svarer i din indbakke, ikke til en robot.",
    error: "Beskeden kom ikke igennem. Prøv igen, eller send os en e-mail direkte.",
    required: "Udfyld navn, e-mail og besked.",
    asideTitle: "Foretrækker du e-mail?",
    asideText: "Vi læser alt, også de lange. Vedhæft et skærmbillede, hvis noget ser i stykker ud.",
    responseTime: "Vi svarer normalt inden for én arbejdsdag.",
    emailLabel: "Send os en e-mail",
    faqTitle: "Før du skriver",
    faq: [
      { q: "Kan jeg opsige selv?", a: "Ja — ét klik i panelet. Ingen e-mail, ingen dårlig samvittighed." },
      { q: "Får jeg pengene tilbage?", a: "Inden 14 dage efter en betaling, hvis du ikke har publiceret et tema. Spørg bare." },
      { q: "Noget ser i stykker ud.", a: "Fortæl hvilket tema, hvilken browser og hvad du forventede. Det er som regel nok." },
    ],
  },
  cookie: {
    badge: "En lille, venlig note",
    title: "Vi bager ikke kager. Vi bygger temaer.",
    body: "Men et par små skal der til for at holde dig logget ind, huske dit sprog og skjule denne boks. Ingen annoncører, ingen kalorier, ingen data til salg.",
    accept: "Ja, tag mine kager",
    essential: "Kun det nødvendige",
    learnMore: "Hvad vi gemmer",
    saved: "Gemt. Kagedåsen er lukket.",
  },
  terms: {
    title: "Vilkår",
    eyebrow: "Det finstillede, på almindeligt dansk",
    updated: "Senest opdateret 18. oktober 2026",
    intro:
      "Disse vilkår gælder, når du bruger ThemeFold — studiet i browseren til at bygge, eksportere og publicere Shopify-temaer. Ved at oprette en konto accepterer du dem.",
    sections: [
      { title: "1. Tjenesten", body: "ThemeFold er et abonnementsstudie, der kører i din browser. Du kan formgive, forhåndsvise, eksportere og publicere Shopify-temaer. En Shopify-butik er kun nødvendig, hvis du vil publicere direkte; byg og eksportér uden." },
      { title: "2. Din konto", body: "Du skal være mindst 16 år, og 18 for at betale for et abonnement. Hold dine loginoplysninger for dig selv. Du er ansvarlig for aktiviteten på kontoen og for at holde din e-mail opdateret." },
      { title: "3. Prøveperiode, pris og betaling", body: "De første tre dage er gratis og kræver intet kort. Derefter koster abonnementet det beløb, der vises i din lokale valuta i kassen (15 DKK om måneden i Danmark), og fornyes automatisk hver 30. dag, indtil du opsiger." },
      { title: "4. Opsigelse og fortrydelsesret", body: "Du kan opsige når som helst i panelet; adgangen gælder perioden ud. Forbrugere i EU har 14 dages fortrydelsesret fra købet. Skriv til os, så løser vi det uden kamp." },
      { title: "5. Dit indhold og vores", body: "Du ejer tekst, billeder og temaer, du skaber. Vi ejer tjenesten, koden, designet og navnet. Logoerne i integrationsrækken tilhører deres respektive ejere og vises kun som reference." },
      { title: "6. Rimelig brug", body: "Brug ikke ThemeFold til noget ulovligt, til at angribe tjenesten, videresælge adgang eller kopiere studiet. Automatiseret massebrug kræver vores skriftlige tilladelse." },
      { title: "7. Tilgængelighed og ansvar", body: "Vi sigter efter 99,5 % oppetid, men lover ingen fejlfri tjeneste. Vores ansvar er begrænset til det, du betalte de seneste tolv måneder, og vi er ikke ansvarlige for indirekte tab som mistet salg eller data. Gem dine egne kopier af eksporterede temaer." },
      { title: "8. Ændringer", body: "Vi kan opdatere vilkårene, når tjenesten udvikler sig. Væsentlige ændringer varsles via e-mail mindst 30 dage før, og hvis du fortsætter med at bruge ThemeFold, accepterer du den nye version." },
      { title: "9. Lov og kontakt", body: "Dansk lov gælder, og tvister afgøres ved dansk almindelig domstol. Spørgsmål om vilkårene: hej@themefold.com." },
    ],
    footerNote: "Sammendraget er skrevet for at kunne læses, ikke for at skjule noget.",
  },
  privacy: {
    title: "Privatlivspolitik",
    eyebrow: "Hvad vi ved, og hvorfor",
    updated: "Senest opdateret 18. oktober 2026",
    intro:
      "ThemeFold har brug for lidt information for at bygge temaer til dig. Her står præcis, hvad vi gemmer, hvorfor, og hvordan du slipper af med det.",
    sections: [
      { title: "1. Hvem er ansvarlig", body: "ThemeFold er dataansvarlig for oplysningerne beskrevet her. Kontakt os på hej@themefold.com ved alle spørgsmål om privatliv." },
      { title: "2. Hvad vi indsamler", body: "Navn og e-mailadresse, en adgangskode der kun gemmes som hash, de temaer og indstillinger du laver, din abonnementsstatus fra Stripe samt tekniske logfiler som IP-adresse og browser, når du bruger tjenesten." },
      { title: "3. Hvorfor vi behandler dem", body: "For at levere tjenesten, du har tegnet (aftale), holde den sikker og rette fejl (berettiget interesse) og — for valgfrie cookies — med dit samtykke. Vi profilerer dig ikke til annoncering." },
      { title: "4. Cookies", body: "Vi bruger strengt nødvendige cookies til sessionen, dit sprogvalg og dit cookievalg. Der sættes ingen reklame- eller sporingscookies. Du kan ændre dit valg ved at slette webstedsdata i browseren." },
      { title: "5. Betalinger", body: "Kortbetalinger håndteres af Stripe. Vi ser eller gemmer aldrig dit kortnummer. Stripe er vores databehandler og kan behandle data i USA under EU's standardkontraktbestemmelser." },
      { title: "6. Hvor længe vi gemmer", body: "Kontooplysninger gemmes, indtil du sletter kontoen. Serverlogfiler gemmes i 90 dage. Regnskabsmateriale gemmes i syv år, fordi dansk lov kræver det." },
      { title: "7. Dine rettigheder", body: "Du har ret til indsigt, berigtigelse, sletning, begrænsning og eksport af dine oplysninger. Skriv til os, og vi svarer inden 30 dage. Du kan også klage til Datatilsynet." },
      { title: "8. Sikkerhed", body: "Adgangskoder hashes, trafikken krypteres med HTTPS, og adgangen til personoplysninger begrænses til det, driften kræver. Ved et brud, der rammer dig, varsler vi dig og Datatilsynet inden 72 timer." },
      { title: "9. Ændringer", body: "Hvis politikken ændres på en måde, der betyder noget, siger vi til i tjenesten eller via e-mail, før ændringen træder i kraft." },
    ],
    footerNote: "Vi indsamler det, vi har brug for til at bygge temaer — ikke ét felt mere.",
  },
};

const fi: SiteCopy = {
  trademark:
    "Kaikki tavaramerkit kuuluvat omistajilleen. Emme ole sidoksissa näihin yrityksiin emmekä saa niiltä hyväksyntää.",
  stripe: { note: "Maksut hoitaa Stripe. Korttitietosi eivät koskaan päädy palvelimillemme.", link: "Näin maksaminen toimii" },
  contact: {
    eyebrow: "Yhteystiedot",
    title: "Sano hei ihmiselle.",
    sub: "Kysyttävää studiosta, outo tema tai lasku, joka kaipaa ystävää? Kirjoita meille — oikea ihminen vastaa, yleensä saman päivän aikana.",
    name: "Nimesi",
    email: "Sähköposti",
    subject: "Aihe",
    message: "Viesti",
    send: "Lähetä viesti",
    sending: "Lähetetään…",
    success: "Kiitos! Vastaamme postilaatikkoosi, emme robotille.",
    error: "Viesti ei mennyt perille. Yritä uudelleen tai lähetä sähköpostia suoraan.",
    required: "Täytä nimi, sähköposti ja viesti.",
    asideTitle: "Kirjoitatko mieluummin sähköpostia?",
    asideText: "Luemme kaiken, myös pitkät viestit. Liitä mukaan kuvakaappaus, jos jokin näyttää rikkinäiseltä.",
    responseTime: "Vastaamme yleensä yhden arkipäivän kuluessa.",
    emailLabel: "Lähetä sähköpostia",
    faqTitle: "Ennen kuin kirjoitat",
    faq: [
      { q: "Voinko lopettaa itse?", a: "Kyllä — yhdellä klikkauksella hallintapaneelissa. Ei sähköpostia, ei syyllisyyttä." },
      { q: "Saanko rahani takaisin?", a: "14 päivän sisällä veloituksesta, jos et ole julkaissut teemaa. Kysy rohkeasti." },
      { q: "Jokin näyttää rikkinäiseltä.", a: "Kerro mikä teema, mikä selain ja mitä odotit. Se riittää yleensä." },
    ],
  },
  cookie: {
    badge: "Pieni ystävällinen ilmoitus",
    title: "Emme leivo keksejä. Rakennamme teemoja.",
    body: "Mutta pieniä tarvitaan, jotta pysyt kirjautuneena, kielesi muistetaan ja tämä laatikko pysyy poissa. Ei mainostajia, ei kaloreita, ei tietojen myyntiä.",
    accept: "Kyllä, ota keksini",
    essential: "Vain välttämättömät",
    learnMore: "Mitä tallennamme",
    saved: "Tallennettu. Keksipurkki on kiinni.",
  },
  terms: {
    title: "Käyttöehdot",
    eyebrow: "Pieni teksti selkokielellä",
    updated: "Päivitetty 18.10.2026",
    intro:
      "Nämä ehdot koskevat ThemeFoldin käyttöä — selaimessa toimivaa studiota Shopify-teemojen rakentamiseen, vientiin ja julkaisuun. Luomalla tilin hyväksyt ne.",
    sections: [
      { title: "1. Palvelu", body: "ThemeFold on selaimessa toimiva tilausstudio. Voit suunnitella, esikatsella, viedä ja julkaista Shopify-teemoja. Shopify-kauppa tarvitaan vain suoraan julkaisuun; rakentaminen ja vienti toimivat ilman." },
      { title: "2. Tilisi", body: "Sinun on oltava vähintään 16-vuotias ja 18-vuotias maksaaksesi tilauksen. Pidä kirjautumistietosi omana tietonasi. Vastaat tilisi toiminnasta ja ajantasaisesta sähköpostiosoitteesta." },
      { title: "3. Kokeilu, hinta ja laskutus", body: "Ensimmäiset kolme päivää ovat ilmaisia eikä korttia tarvita. Sen jälkeen tilaus maksaa kassassa näkyvän summan paikallisessa valuutassasi (1,85 € kuukaudessa Suomessa) ja uusiutuu automaattisesti 30 päivän välein, kunnes lopetat." },
      { title: "4. Lopettaminen ja peruutusoikeus", body: "Voit lopettaa milloin tahansa hallintapaneelista; käyttöoikeus jatkuu jakson loppuun. EU:n kuluttajilla on 14 päivän peruutusoikeus ostoksesta. Kirjoita meille, niin hoidamme asian ilman kinastelua." },
      { title: "5. Sinun ja meidän sisältömme", body: "Omistat luomasi tekstit, kuvat ja teemat. Me omistamme palvelun, koodin, ulkoasun ja nimen. Integraatiorivin logot kuuluvat omistajilleen ja näytetään vain viittauksena." },
      { title: "6. Kohtuullinen käyttö", body: "Älä käytä ThemeFoldia laittomaan toimintaan, palvelun vahingoittamiseen, käyttöoikeuden jälleenmyyntiin tai studion kopioimiseen. Automaattinen massakäyttö vaatii kirjallisen lupamme." },
      { title: "7. Saatavuus ja vastuu", body: "Tavoittelemme 99,5 % käytettävyyttä, mutta emme lupaa virheetöntä palvelua. Vastuumme rajoittuu viimeisten kahdentoista kuukauden aikana maksamaasi summaan, emmekä vastaa välillisistä menetyksistä kuten menetetyistä myynneistä tai tiedoista. Tallenna omat kopiot viedyistä teemoista." },
      { title: "8. Muutokset", body: "Voimme päivittää ehtoja palvelun kehittyessä. Olennaisista muutoksista ilmoitetaan sähköpostitse vähintään 30 päivää ennen, ja jatkamalla ThemeFoldin käyttöä hyväksyt uuden version." },
      { title: "9. Laki ja yhteystiedot", body: "Sovelletaan Suomen lakia ja riidat ratkaisee suomalainen yleinen tuomioistuin. Kysymykset ehdoista: hello@themefold.com." },
    ],
    footerNote: "Yhteenveto on kirjoitettu luettavaksi, ei asioiden piilottamiseksi.",
  },
  privacy: {
    title: "Tietosuojaseloste",
    eyebrow: "Mitä tiedämme ja miksi",
    updated: "Päivitetty 18.10.2026",
    intro:
      "ThemeFold tarvitsee hieman tietoja rakentaakseen sinulle teemoja. Täällä kerrotaan tarkasti, mitä tallennamme, miksi ja miten pääset niistä eroon.",
    sections: [
      { title: "1. Rekisterinpitäjä", body: "ThemeFold on tässä kuvattujen tietojen rekisterinpitäjä. Yhteys kaikissa tietosuoja-asioissa: hello@themefold.com." },
      { title: "2. Mitä keräämme", body: "Nimi ja sähköpostiosoite, salasana vain tiivisteenä, luomasi teemat ja asetukset, tilauksesi tila Stripeltä sekä tekniset lokit, kuten IP-osoite ja selain, palvelua käyttäessäsi." },
      { title: "3. Miksi käsittelemme niitä", body: "Jotta voimme toimittaa tilaamasi palvelun (sopimus), pitää sen turvallisena ja korjata virheitä (oikeutettu etu) sekä valinnaisten keksien osalta suostumuksellasi. Emme profiiloi sinua mainontaa varten." },
      { title: "4. Keksit", body: "Käytämme välttämättömiä keksejä istuntoon, kielivalintaasi ja keksivalintaasi. Mainos- tai seurantakeksejä ei aseteta. Voit muuttaa valintaasi tyhjentämällä sivuston tiedot selaimestasi." },
      { title: "5. Maksut", body: "Korttimaksut hoitaa Stripe. Emme koskaan näe tai tallenna korttinumeroasi. Stripe on henkilötietojen käsittelijämme ja voi käsitellä tietoja Yhdysvalloissa EU:n vakiolausekkeiden mukaisesti." },
      { title: "6. Säilytysaika", body: "Tilitiedot säilytetään, kunnes poistat tilisi. Palvelinlokit säilytetään 90 päivää. Kirjanpitoaineisto säilytetään seitsemän vuotta Suomen lain vaatimuksesta." },
      { title: "7. Oikeutesi", body: "Sinulla on oikeus tarkastaa, oikaista, poistaa, rajoittaa ja siirtää tietosi. Kirjoita meille, niin vastaamme 30 päivän kuluessa. Voit myös valittaa tietosuojavaltuutetun toimistolle." },
      { title: "8. Turvallisuus", body: "Salasanat tiivistetään, liikenne salataan HTTPS:llä ja pääsy henkilötietoihin rajataan siihen, mitä ylläpito vaatii. Jos tietomurto koskee sinua, ilmoitamme sinulle ja tietosuojavaltuutetulle 72 tunnin kuluessa." },
      { title: "9. Muutokset", body: "Jos selostetta muutetaan merkittävästi, kerromme siitä palvelussa tai sähköpostitse ennen muutoksen voimaantuloa." },
    ],
    footerNote: "Keräämme sen, mitä teemojen rakentaminen vaatii — emme yhtään kenttää enempää.",
  },
};

const fr: SiteCopy = {
  trademark:
    "Toutes les marques appartiennent à leurs propriétaires respectifs. Nous ne sommes ni affiliés ni approuvés par ces entreprises.",
  stripe: { note: "Les paiements sont traités par Stripe. Vos données bancaires ne touchent jamais nos serveurs.", link: "Comment ça marche" },
  contact: {
    eyebrow: "Contact",
    title: "Dites bonjour à un humain.",
    sub: "Une question sur le studio, un thème qui semble bizarre, ou une facture qui cherche un ami ? Écrivez-nous — une vraie personne répond, souvent dans la journée.",
    name: "Votre nom",
    email: "E-mail",
    subject: "Sujet",
    message: "Message",
    send: "Envoyer le message",
    sending: "Envoi…",
    success: "Merci ! Nous répondons dans votre boîte mail, pas à un robot.",
    error: "Le message n'est pas passé. Réessayez ou écrivez-nous directement.",
    required: "Indiquez votre nom, votre e-mail et un message.",
    asideTitle: "Vous préférez l'e-mail ?",
    asideText: "Nous lisons tout, même les longs messages. Joignez une capture d'écran si quelque chose semble cassé.",
    responseTime: "Réponse généralement sous un jour ouvré.",
    emailLabel: "Écrivez-nous",
    faqTitle: "Avant d'écrire",
    faq: [
      { q: "Puis-je résilier moi-même ?", a: "Oui — un clic dans le tableau de bord. Sans e-mail, sans culpabilité." },
      { q: "Y a-t-il des remboursements ?", a: "Dans les 14 jours suivant un prélèvement, si vous n'avez pas publié de thème. Demandez, c'est tout." },
      { q: "Quelque chose semble cassé.", a: "Dites-nous quel thème, quel navigateur et ce que vous attendiez. C'est souvent suffisant." },
    ],
  },
  cookie: {
    badge: "Un petit mot sympa",
    title: "Nous ne faisons pas de cookies. Nous faisons des thèmes.",
    body: "Mais quelques miettes nous permettent de garder votre session, votre langue et de cacher cette fenêtre. Pas de publicitaires, pas de calories, pas de revente de données.",
    accept: "Oui, passez les cookies",
    essential: "Seulement l'essentiel",
    learnMore: "Ce que nous stockons",
    saved: "Enregistré. Le bocal est fermé.",
  },
  terms: {
    title: "Conditions d'utilisation",
    eyebrow: "Les petites lignes, en clair",
    updated: "Dernière mise à jour le 18 octobre 2026",
    intro:
      "Ces conditions s'appliquent lorsque vous utilisez ThemeFold — le studio dans le navigateur pour concevoir, exporter et publier des thèmes Shopify. En créant un compte, vous les acceptez.",
    sections: [
      { title: "1. Le service", body: "ThemeFold est un studio par abonnement qui fonctionne dans votre navigateur. Vous pouvez concevoir, prévisualiser, exporter et publier des thèmes Shopify. Une boutique Shopify n'est nécessaire que pour publier directement ; créer et exporter fonctionne sans." },
      { title: "2. Votre compte", body: "Vous devez avoir au moins 16 ans, et 18 ans pour payer un abonnement. Gardez vos identifiants pour vous. Vous êtes responsable de l'activité sur votre compte et de l'exactitude de votre adresse e-mail." },
      { title: "3. Essai, prix et facturation", body: "Les trois premiers jours sont gratuits et sans carte. Ensuite, l'abonnement coûte le montant affiché dans votre devise locale au paiement (1,85 € par mois en France) et se renouvelle automatiquement tous les 30 jours jusqu'à résiliation." },
      { title: "4. Résiliation et droit de rétractation", body: "Vous pouvez résilier à tout moment depuis le tableau de bord ; l'accès reste actif jusqu'à la fin de la période payée. Les consommateurs de l'UE disposent de 14 jours de rétractation. Écrivez-nous, nous réglerons cela sans débat." },
      { title: "5. Vos contenus et les nôtres", body: "Vous êtes propriétaire des textes, images et thèmes que vous créez. Nous sommes propriétaires du service, de son code, de son design et de son nom. Les logos de la bande d'intégrations appartiennent à leurs propriétaires et ne servent que de référence." },
      { title: "6. Usage raisonnable", body: "N'utilisez pas ThemeFold pour une activité illégale, pour attaquer le service, revendre l'accès ou copier le studio. L'usage automatisé en masse nécessite notre autorisation écrite." },
      { title: "7. Disponibilité et responsabilité", body: "Nous visons 99,5 % de disponibilité sans promettre un service parfait. Notre responsabilité est limitée à ce que vous avez payé pendant les douze derniers mois, et nous ne répondons pas des pertes indirectes comme un chiffre d'affaires manqué ou des données perdues. Conservez vos propres copies des thèmes exportés." },
      { title: "8. Modifications", body: "Nous pouvons mettre à jour ces conditions avec l'évolution du service. Les changements importants sont annoncés par e-mail au moins 30 jours à l'avance ; continuer à utiliser ThemeFold vaut acceptation." },
      { title: "9. Droit et contact", body: "Le droit suédois s'applique et les litiges relèvent d'un tribunal suédois. Questions : hello@themefold.com." },
    ],
    footerNote: "Ce résumé est écrit pour être lisible, pas pour cacher quelque chose.",
  },
  privacy: {
    title: "Politique de confidentialité",
    eyebrow: "Ce que nous savons, et pourquoi",
    updated: "Dernière mise à jour le 18 octobre 2026",
    intro:
      "ThemeFold a besoin de quelques informations pour créer vos thèmes. Cette page explique exactement ce que nous stockons, pourquoi, et comment vous en débarrasser.",
    sections: [
      { title: "1. Responsable du traitement", body: "ThemeFold est responsable des données personnelles décrites ici. Écrivez-nous à hello@themefold.com pour toute question." },
      { title: "2. Ce que nous collectons", body: "Votre nom et votre adresse e-mail, un mot de passe stocké uniquement sous forme de hachage, les thèmes et réglages que vous créez, votre statut d'abonnement chez Stripe, et des journaux techniques (adresse IP, navigateur) lors de votre utilisation." },
      { title: "3. Pourquoi nous les traitons", body: "Pour fournir le service souscrit (contrat), le sécuriser et corriger les erreurs (intérêt légitime) et — pour les cookies optionnels — avec votre consentement. Nous ne vous profilons pas à des fins publicitaires." },
      { title: "4. Cookies", body: "Nous utilisons des cookies strictement nécessaires pour votre session, votre langue et votre choix de cookies. Aucun cookie publicitaire ou de suivi n'est déposé. Vous pouvez modifier votre choix en effaçant les données du site dans votre navigateur." },
      { title: "5. Paiements", body: "Les paiements par carte sont traités par Stripe. Nous ne voyons ni ne stockons jamais votre numéro de carte. Stripe agit comme sous-traitant et peut traiter des données aux États-Unis selon les clauses contractuelles types de l'UE." },
      { title: "6. Durée de conservation", body: "Les données du compte sont conservées jusqu'à sa suppression. Les journaux serveur sont conservés 90 jours. Les pièces comptables sont conservées sept ans, comme l'exige la loi suédoise." },
      { title: "7. Vos droits", body: "Vous pouvez accéder à vos données, les rectifier, les supprimer, en limiter le traitement et les exporter. Écrivez-nous, nous répondons sous 30 jours. Vous pouvez aussi saisir l'autorité suédoise de protection des données (IMY)." },
      { title: "8. Sécurité", body: "Les mots de passe sont hachés, le trafic est chiffré en HTTPS et l'accès aux données personnelles est limité au nécessaire. En cas de violation vous concernant, nous vous informons ainsi que l'IMY dans les 72 heures." },
      { title: "9. Modifications", body: "Si cette politique change de façon importante, nous vous prévenons dans le service ou par e-mail avant l'entrée en vigueur." },
    ],
    footerNote: "Nous collectons le nécessaire pour créer des thèmes — pas un champ de plus.",
  },
};

const de: SiteCopy = {
  trademark:
    "Alle Marken gehören ihren jeweiligen Inhabern. Wir sind weder mit diesen Unternehmen verbunden noch von ihnen unterstützt.",
  stripe: { note: "Zahlungen werden von Stripe abgewickelt. Deine Kartendaten erreichen nie unsere Server.", link: "So funktioniert die Zahlung" },
  contact: {
    eyebrow: "Kontakt",
    title: "Sag Hallo zu einem Menschen.",
    sub: "Fragen zum Studio, ein Theme, das seltsam aussieht, oder eine Rechnung, die einen Freund braucht? Schreib uns — ein echter Mensch antwortet, meist noch am selben Tag.",
    name: "Dein Name",
    email: "E-Mail",
    subject: "Betreff",
    message: "Nachricht",
    send: "Nachricht senden",
    sending: "Wird gesendet…",
    success: "Danke! Wir antworten in deinem Postfach, nicht an einen Roboter.",
    error: "Die Nachricht kam nicht an. Versuch es erneut oder schreib uns direkt.",
    required: "Bitte Name, E-Mail und Nachricht ausfüllen.",
    asideTitle: "Lieber per E-Mail?",
    asideText: "Wir lesen alles, auch die langen Nachrichten. Hänge einen Screenshot an, wenn etwas kaputt aussieht.",
    responseTime: "Antwort meist innerhalb eines Werktags.",
    emailLabel: "Schreib uns",
    faqTitle: "Bevor du schreibst",
    faq: [
      { q: "Kann ich selbst kündigen?", a: "Ja — ein Klick im Dashboard. Keine E-Mail, kein schlechtes Gewissen." },
      { q: "Gibt es Rückerstattungen?", a: "Innerhalb von 14 Tagen nach einer Abbuchung, wenn du kein Theme veröffentlicht hast. Einfach fragen." },
      { q: "Etwas sieht kaputt aus.", a: "Sag uns welches Theme, welcher Browser und was du erwartet hast. Das reicht meistens." },
    ],
  },
  cookie: {
    badge: "Ein kleiner, freundlicher Hinweis",
    title: "Wir backen keine Kekse. Wir bauen Themes.",
    body: "Aber ein paar kleine halten dich angemeldet, merken sich deine Sprache und verstecken diese Box. Keine Werbetreibenden, keine Kalorien, kein Datenverkauf.",
    accept: "Ja, her mit den Keksen",
    essential: "Nur das Nötigste",
    learnMore: "Was wir speichern",
    saved: "Gespeichert. Die Keksdose ist zu.",
  },
  terms: {
    title: "AGB",
    eyebrow: "Das Kleingedruckte, verständlich",
    updated: "Zuletzt aktualisiert am 18. Oktober 2026",
    intro:
      "Diese Bedingungen gelten, wenn du ThemeFold nutzt — das Studio im Browser zum Bauen, Exportieren und Veröffentlichen von Shopify-Themes. Mit der Kontoerstellung akzeptierst du sie.",
    sections: [
      { title: "1. Der Dienst", body: "ThemeFold ist ein Abo-Studio, das im Browser läuft. Du kannst Shopify-Themes gestalten, ansehen, exportieren und veröffentlichen. Ein Shopify-Shop ist nur für das direkte Veröffentlichen nötig; Bauen und Exportieren funktioniert ohne." },
      { title: "2. Dein Konto", body: "Du musst mindestens 16 Jahre alt sein, 18 für ein bezahltes Abo. Halte deine Zugangsdaten für dich. Du bist für die Aktivität auf deinem Konto und eine aktuelle E-Mail-Adresse verantwortlich." },
      { title: "3. Testphase, Preis und Abrechnung", body: "Die ersten drei Tage sind kostenlos und ohne Karte. Danach kostet das Abo den im Checkout angezeigten Betrag in deiner Landeswährung (1,85 € pro Monat in Deutschland) und verlängert sich automatisch alle 30 Tage, bis du kündigst." },
      { title: "4. Kündigung und Widerruf", body: "Du kannst jederzeit im Dashboard kündigen; der Zugang bleibt bis zum Ende des bezahlten Zeitraums. Verbraucher in der EU haben 14 Tage Widerrufsrecht. Schreib uns, wir lösen das ohne Streit." },
      { title: "5. Deine und unsere Inhalte", body: "Du besitzt Texte, Bilder und Themes, die du erstellst. Wir besitzen den Dienst, den Code, das Design und den Namen. Die Logos in der Integrationsleiste gehören ihren Inhabern und dienen nur als Hinweis." },
      { title: "6. Faire Nutzung", body: "Nutze ThemeFold nicht für Illegales, zum Angriff auf den Dienst, zum Weiterverkauf des Zugangs oder zum Kopieren des Studios. Automatisierte Massennutzung braucht unsere schriftliche Erlaubnis." },
      { title: "7. Verfügbarkeit und Haftung", body: "Wir streben 99,5 % Verfügbarkeit an, versprechen aber keinen fehlerfreien Dienst. Unsere Haftung ist auf das beschränkt, was du in den letzten zwölf Monaten gezahlt hast; für indirekte Schäden wie entgangenen Umsatz oder Datenverlust haften wir nicht. Bewahre eigene Kopien exportierter Themes auf." },
      { title: "8. Änderungen", body: "Wir können diese Bedingungen mit der Weiterentwicklung des Dienstes aktualisieren. Wesentliche Änderungen kündigen wir mindestens 30 Tage vorher per E-Mail an; die weitere Nutzung gilt als Zustimmung." },
      { title: "9. Recht und Kontakt", body: "Es gilt schwedisches Recht, Streitigkeiten entscheidet ein schwedisches Gericht. Fragen: hello@themefold.com." },
    ],
    footerNote: "Diese Zusammenfassung ist zum Lesen geschrieben, nicht zum Verstecken.",
  },
  privacy: {
    title: "Datenschutzerklärung",
    eyebrow: "Was wir wissen, und warum",
    updated: "Zuletzt aktualisiert am 18. Oktober 2026",
    intro:
      "ThemeFold braucht ein paar Informationen, um Themes für dich zu bauen. Hier steht genau, was wir speichern, warum, und wie du es loswirst.",
    sections: [
      { title: "1. Verantwortlicher", body: "ThemeFold ist verantwortlich für die hier beschriebenen personenbezogenen Daten. Kontakt bei allen Datenschutzfragen: hello@themefold.com." },
      { title: "2. Was wir erheben", body: "Name und E-Mail-Adresse, ein nur als Hash gespeichertes Passwort, die von dir erstellten Themes und Einstellungen, dein Abo-Status von Stripe sowie technische Protokolle wie IP-Adresse und Browser bei der Nutzung." },
      { title: "3. Warum wir verarbeiten", body: "Um den gebuchten Dienst zu liefern (Vertrag), ihn sicher zu halten und Fehler zu beheben (berechtigtes Interesse) und — bei optionalen Cookies — mit deiner Einwilligung. Wir erstellen keine Werbeprofile." },
      { title: "4. Cookies", body: "Wir nutzen unbedingt erforderliche Cookies für Sitzung, Sprache und deine Cookie-Wahl. Werbe- oder Tracking-Cookies setzen wir nicht. Du kannst deine Wahl ändern, indem du die Websitedaten im Browser löschst." },
      { title: "5. Zahlungen", body: "Kartenzahlungen wickelt Stripe ab. Wir sehen und speichern deine Kartennummer nie. Stripe ist unser Auftragsverarbeiter und kann Daten in den USA nach den EU-Standardvertragsklauseln verarbeiten." },
      { title: "6. Speicherdauer", body: "Kontodaten bleiben bis zur Löschung des Kontos. Serverprotokolle werden 90 Tage aufbewahrt. Buchhaltungsunterlagen sieben Jahre, weil schwedisches Recht das verlangt." },
      { title: "7. Deine Rechte", body: "Du hast Recht auf Auskunft, Berichtigung, Löschung, Einschränkung und Übertragbarkeit. Schreib uns, wir antworten innerhalb von 30 Tagen. Du kannst dich auch bei der schwedischen Datenschutzbehörde (IMY) beschweren." },
      { title: "8. Sicherheit", body: "Passwörter werden gehasht, der Verkehr mit HTTPS verschlüsselt und der Zugriff auf personenbezogene Daten auf das Nötige begrenzt. Bei einer Verletzung, die dich betrifft, informieren wir dich und die IMY innerhalb von 72 Stunden." },
      { title: "9. Änderungen", body: "Ändert sich diese Erklärung wesentlich, sagen wir es im Dienst oder per E-Mail, bevor die Änderung gilt." },
    ],
    footerNote: "Wir erheben, was zum Bauen von Themes nötig ist — kein Feld mehr.",
  },
};

const es: SiteCopy = {
  trademark:
    "Todas las marcas pertenecen a sus respectivos propietarios. No tenemos relación ni estamos respaldados por estas empresas.",
  stripe: { note: "Los pagos los gestiona Stripe. Tus datos de tarjeta nunca llegan a nuestros servidores.", link: "Cómo funciona el pago" },
  contact: {
    eyebrow: "Contacto",
    title: "Saluda a una persona.",
    sub: "¿Dudas sobre el estudio, un tema que se ve raro o una factura que necesita un amigo? Escríbenos: responde una persona real, normalmente el mismo día.",
    name: "Tu nombre",
    email: "Correo electrónico",
    subject: "Asunto",
    message: "Mensaje",
    send: "Enviar mensaje",
    sending: "Enviando…",
    success: "¡Recibido! Respondemos a tu bandeja de entrada, no a un robot.",
    error: "El mensaje no llegó. Inténtalo otra vez o escríbenos directamente.",
    required: "Rellena tu nombre, correo y mensaje.",
    asideTitle: "¿Prefieres el correo?",
    asideText: "Lo leemos todo, incluso los mensajes largos. Adjunta una captura si algo parece roto.",
    responseTime: "Solemos responder en un día laborable.",
    emailLabel: "Escríbenos",
    faqTitle: "Antes de escribir",
    faq: [
      { q: "¿Puedo cancelar yo mismo?", a: "Sí: un clic en el panel. Sin correos y sin culpa." },
      { q: "¿Hay reembolsos?", a: "Dentro de los 14 días posteriores a un cobro, si no has publicado un tema. Solo pídelo." },
      { q: "Algo se ve roto.", a: "Cuéntanos qué tema, qué navegador y qué esperabas. Casi siempre basta." },
    ],
  },
  cookie: {
    badge: "Un aviso pequeño y amable",
    title: "No horneamos galletas. Construimos temas.",
    body: "Pero unas pocas mantienen tu sesión, recuerdan tu idioma y esconden esta caja. Sin anunciantes, sin calorías y sin vender tus datos.",
    accept: "Sí, pasa las galletas",
    essential: "Solo lo esencial",
    learnMore: "Qué guardamos",
    saved: "Guardado. El tarro está cerrado.",
  },
  terms: {
    title: "Términos del servicio",
    eyebrow: "La letra pequeña, en claro",
    updated: "Última actualización: 18 de octubre de 2026",
    intro:
      "Estos términos se aplican cuando usas ThemeFold, el estudio en el navegador para crear, exportar y publicar temas de Shopify. Al crear una cuenta los aceptas.",
    sections: [
      { title: "1. El servicio", body: "ThemeFold es un estudio por suscripción que funciona en tu navegador. Puedes diseñar, previsualizar, exportar y publicar temas de Shopify. Solo necesitas una tienda Shopify para publicar directamente; crear y exportar funciona sin ella." },
      { title: "2. Tu cuenta", body: "Debes tener al menos 16 años, y 18 para pagar una suscripción. Mantén tus credenciales para ti. Eres responsable de la actividad de tu cuenta y de mantener tu correo actualizado." },
      { title: "3. Prueba, precio y facturación", body: "Los tres primeros días son gratis y sin tarjeta. Después, la suscripción cuesta el importe mostrado en tu moneda local al pagar (1,85 € al mes en España) y se renueva automáticamente cada 30 días hasta que canceles." },
      { title: "4. Cancelación y derecho de desistimiento", body: "Puedes cancelar cuando quieras desde el panel; el acceso dura hasta el final del periodo pagado. Los consumidores de la UE tienen 14 días de desistimiento. Escríbenos y lo resolvemos sin discutir." },
      { title: "5. Tu contenido y el nuestro", body: "Eres dueño de los textos, imágenes y temas que creas. Nosotros somos dueños del servicio, su código, diseño y nombre. Los logotipos de la franja de integraciones pertenecen a sus dueños y solo se muestran como referencia." },
      { title: "6. Uso razonable", body: "No uses ThemeFold para nada ilegal, para atacar el servicio, revender el acceso ni copiar el estudio. El uso masivo automatizado requiere nuestro permiso por escrito." },
      { title: "7. Disponibilidad y responsabilidad", body: "Buscamos un 99,5 % de disponibilidad, pero no prometemos un servicio perfecto. Nuestra responsabilidad se limita a lo que pagaste en los últimos doce meses y no cubre daños indirectos como ventas o datos perdidos. Guarda tus propias copias de los temas exportados." },
      { title: "8. Cambios", body: "Podemos actualizar estos términos a medida que evoluciona el servicio. Los cambios importantes se avisan por correo con al menos 30 días de antelación; seguir usando ThemeFold implica aceptarlos." },
      { title: "9. Ley y contacto", body: "Se aplica la ley sueca y los litigios los resuelve un tribunal sueco. Dudas: hello@themefold.com." },
    ],
    footerNote: "Este resumen está escrito para leerse, no para esconder nada.",
  },
  privacy: {
    title: "Política de privacidad",
    eyebrow: "Qué sabemos y por qué",
    updated: "Última actualización: 18 de octubre de 2026",
    intro:
      "ThemeFold necesita algo de información para crear tus temas. Aquí explicamos exactamente qué guardamos, por qué y cómo deshacerte de ello.",
    sections: [
      { title: "1. Quién es responsable", body: "ThemeFold es el responsable de los datos personales aquí descritos. Escríbenos a hello@themefold.com para cualquier duda de privacidad." },
      { title: "2. Qué recogemos", body: "Tu nombre y correo, una contraseña guardada solo como hash, los temas y ajustes que creas, tu estado de suscripción de Stripe y registros técnicos como la IP y el navegador cuando usas el servicio." },
      { title: "3. Por qué los tratamos", body: "Para prestar el servicio que contrataste (contrato), mantenerlo seguro y corregir errores (interés legítimo) y —en cookies opcionales— con tu consentimiento. No te perfilamos para publicidad." },
      { title: "4. Cookies", body: "Usamos cookies estrictamente necesarias para la sesión, tu idioma y tu elección de cookies. No ponemos cookies publicitarias ni de seguimiento. Puedes cambiar tu elección borrando los datos del sitio en el navegador." },
      { title: "5. Pagos", body: "Los pagos con tarjeta los gestiona Stripe. Nunca vemos ni guardamos tu número de tarjeta. Stripe actúa como encargado del tratamiento y puede tratar datos en EE. UU. bajo las cláusulas contractuales tipo de la UE." },
      { title: "6. Cuánto tiempo", body: "Los datos de la cuenta se conservan hasta que la borras. Los registros del servidor, 90 días. Los documentos contables, siete años, porque la ley sueca lo exige." },
      { title: "7. Tus derechos", body: "Tienes derecho a acceder, rectificar, suprimir, limitar y exportar tus datos. Escríbenos y respondemos en 30 días. También puedes reclamar ante la autoridad sueca de protección de datos (IMY)." },
      { title: "8. Seguridad", body: "Las contraseñas se cifran con hash, el tráfico va por HTTPS y el acceso a los datos personales se limita a lo necesario. Si una brecha te afecta, te avisamos a ti y a la IMY en 72 horas." },
      { title: "9. Cambios", body: "Si esta política cambia de forma relevante, lo avisamos en el servicio o por correo antes de que se aplique." },
    ],
    footerNote: "Recogemos lo necesario para crear temas, ni un campo más.",
  },
};

export const SITE_COPY: Record<Locale, SiteCopy> = { sv, nb, fi, da, en, fr, de, es };

export function siteCopy(locale: string): SiteCopy {
  return SITE_COPY[(locale as Locale) in SITE_COPY ? (locale as Locale) : "en"];
}
