import type { Locale } from "@/lib/theme/types";

/** Etiketter för de sex stegen som hero-demon spelar upp. */
export const HERO_DEMO: Record<Locale, { phases: string[]; building: string; published: string }> = {
  sv: { phases: ["Känsla", "Form", "Typografi", "Sektioner", "Sidor", "Publicera"], building: "Bygger ditt tema", published: "Publicerad" },
  nb: { phases: ["Stemning", "Form", "Typografi", "Seksjoner", "Sider", "Publiser"], building: "Bygger temaet ditt", published: "Publisert" },
  fi: { phases: ["Tunnelma", "Muoto", "Typografia", "Osiot", "Sivut", "Julkaise"], building: "Rakennetaan teemaasi", published: "Julkaistu" },
  da: { phases: ["Stemning", "Form", "Typografi", "Sektioner", "Sider", "Publicér"], building: "Bygger dit tema", published: "Publiceret" },
  en: { phases: ["Mood", "Shape", "Type", "Sections", "Pages", "Publish"], building: "Building your theme", published: "Published" },
  fr: { phases: ["Ambiance", "Forme", "Typographie", "Sections", "Pages", "Publier"], building: "Création de votre thème", published: "Publié" },
  de: { phases: ["Stimmung", "Form", "Typografie", "Sektionen", "Seiten", "Veröffentlichen"], building: "Dein Theme entsteht", published: "Veröffentlicht" },
  es: { phases: ["Ambiente", "Forma", "Tipografía", "Secciones", "Páginas", "Publicar"], building: "Creando tu tema", published: "Publicado" },
};
