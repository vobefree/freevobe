import type { Locale } from "@/lib/theme/types";

export type AuthSocialStrings = {
  divider: string;
  shopifyTitle: string;
  shopifySub: string;
  shopPlaceholder: string;
  shopifyCta: string;
  shopifyNotConfigured: string;
  socialTitle: string;
  socialSub: string;
  socialNotConfigured: string;
  noticeConfig: string;
  noticeInvalid: string;
  noticeNoAccount: string;
  noticeState: string;
  noticeExchange: string;
  noticeEmail: string;
  noticeSocialConfig: string;
};

const en: AuthSocialStrings = {
  divider: "or",
  shopifyTitle: "Sign in with Shopify",
  shopifySub: "Use the store that is already connected to your account.",
  shopPlaceholder: "your-shop",
  shopifyCta: "Continue with Shopify",
  shopifyNotConfigured: "Shopify login activates when SHOPIFY_API_KEY and SHOPIFY_API_SECRET are set.",
  socialTitle: "Social sign-in",
  socialSub: "One click with an account you already have.",
  socialNotConfigured: "Google and Facebook sign-in activate when their client keys are set.",
  noticeConfig: "Shopify login is not configured yet.",
  noticeInvalid: "Enter a valid Shopify store, for example your-shop.",
  noticeNoAccount: "That store is not connected to a Temply account yet. Create an account and connect the store.",
  noticeState: "The login link expired. Please try again.",
  noticeExchange: "Shopify could not complete the login. Please try again.",
  noticeEmail: "The provider did not share an email address, so we could not sign you in.",
  noticeSocialConfig: "That sign-in method is not configured yet.",
};

const sv: AuthSocialStrings = {
  divider: "eller",
  shopifyTitle: "Logga in med Shopify",
  shopifySub: "Använd butiken som redan är kopplad till ditt konto.",
  shopPlaceholder: "din-butik",
  shopifyCta: "Fortsätt med Shopify",
  shopifyNotConfigured: "Shopify-inloggning aktiveras när SHOPIFY_API_KEY och SHOPIFY_API_SECRET är satta.",
  socialTitle: "Social inloggning",
  socialSub: "Ett klick med ett konto du redan har.",
  socialNotConfigured: "Google- och Facebook-inloggning aktiveras när deras klientnycklar är satta.",
  noticeConfig: "Shopify-inloggning är inte konfigurerad ännu.",
  noticeInvalid: "Ange en giltig Shopify-butik, till exempel din-butik.",
  noticeNoAccount: "Butiken är inte kopplad till något Temply-konto ännu. Skapa ett konto och koppla butiken.",
  noticeState: "Inloggningslänken har gått ut. Försök igen.",
  noticeExchange: "Shopify kunde inte slutföra inloggningen. Försök igen.",
  noticeEmail: "Leverantören delade ingen e-postadress, så vi kunde inte logga in dig.",
  noticeSocialConfig: "Den inloggningsmetoden är inte konfigurerad ännu.",
};

const nb: AuthSocialStrings = {
  ...en,
  divider: "eller",
  shopifyTitle: "Logg inn med Shopify",
  shopifySub: "Bruk butikken som allerede er koblet til kontoen din.",
  shopPlaceholder: "din-butikk",
  shopifyCta: "Fortsett med Shopify",
  shopifyNotConfigured: "Shopify-innlogging aktiveres når SHOPIFY_API_KEY og SHOPIFY_API_SECRET er satt.",
  socialTitle: "Sosial innlogging",
  socialSub: "Ett klikk med en konto du allerede har.",
  socialNotConfigured: "Google- og Facebook-innlogging aktiveres når klientnøklene er satt.",
  noticeConfig: "Shopify-innlogging er ikke konfigurert ennå.",
  noticeInvalid: "Oppgi en gyldig Shopify-butikk, for eksempel din-butikk.",
  noticeNoAccount: "Butikken er ikke koblet til en Temply-konto ennå. Opprett en konto og koble butikken.",
  noticeState: "Innloggingslenken er utløpt. Prøv igjen.",
  noticeExchange: "Shopify kunne ikke fullføre innloggingen. Prøv igjen.",
  noticeEmail: "Leverandøren delte ingen e-postadresse, så vi kunne ikke logge deg inn.",
  noticeSocialConfig: "Den innloggingsmetoden er ikke konfigurert ennå.",
};

const fi: AuthSocialStrings = {
  ...en,
  divider: "tai",
  shopifyTitle: "Kirjaudu Shopifylla",
  shopifySub: "Käytä kauppaa, joka on jo yhdistetty tiliisi.",
  shopPlaceholder: "oma-kauppa",
  shopifyCta: "Jatka Shopifyn kautta",
  shopifyNotConfigured: "Shopify-kirjautuminen aktivoituu, kun SHOPIFY_API_KEY ja SHOPIFY_API_SECRET on asetettu.",
  socialTitle: "Sosiaalinen kirjautuminen",
  socialSub: "Yhdellä klikkauksella olemassa olevalla tilillä.",
  socialNotConfigured: "Google- ja Facebook-kirjautuminen aktivoituu, kun asiakasavaimet on asetettu.",
  noticeConfig: "Shopify-kirjautumista ei ole vielä määritetty.",
  noticeInvalid: "Anna kelvollinen Shopify-kauppa, esimerkiksi oma-kauppa.",
  noticeNoAccount: "Kauppaa ei ole vielä yhdistetty Temply-tiliin. Luo tili ja yhdistä kauppa.",
  noticeState: "Kirjautumislinkki on vanhentunut. Yritä uudelleen.",
  noticeExchange: "Shopify ei voinut viimeistellä kirjautumista. Yritä uudelleen.",
  noticeEmail: "Palvelu ei jakanut sähköpostiosoitetta, joten kirjautuminen ei onnistunut.",
  noticeSocialConfig: "Kyseistä kirjautumistapaa ei ole vielä määritetty.",
};

const da: AuthSocialStrings = {
  ...en,
  divider: "eller",
  shopifyTitle: "Log ind med Shopify",
  shopifySub: "Brug butikken, der allerede er knyttet til din konto.",
  shopPlaceholder: "din-butik",
  shopifyCta: "Fortsæt med Shopify",
  shopifyNotConfigured: "Shopify-login aktiveres, når SHOPIFY_API_KEY og SHOPIFY_API_SECRET er sat.",
  socialTitle: "Social login",
  socialSub: "Et klik med en konto, du allerede har.",
  socialNotConfigured: "Google- og Facebook-login aktiveres, når klientnøglerne er sat.",
  noticeConfig: "Shopify-login er ikke konfigureret endnu.",
  noticeInvalid: "Angiv en gyldig Shopify-butik, for eksempel din-butik.",
  noticeNoAccount: "Butikken er ikke knyttet til en Temply-konto endnu. Opret en konto og knyt butikken.",
  noticeState: "Loginlinket er udløbet. Prøv igen.",
  noticeExchange: "Shopify kunne ikke gennemføre login. Prøv igen.",
  noticeEmail: "Udbyderen delte ikke en e-mailadresse, så vi kunne ikke logge dig ind.",
  noticeSocialConfig: "Den loginmetode er ikke konfigureret endnu.",
};

const fr: AuthSocialStrings = {
  ...en,
  divider: "ou",
  shopifyTitle: "Se connecter avec Shopify",
  shopifySub: "Utilisez la boutique déjà liée à votre compte.",
  shopPlaceholder: "votre-boutique",
  shopifyCta: "Continuer avec Shopify",
  shopifyNotConfigured: "La connexion Shopify s'active quand SHOPIFY_API_KEY et SHOPIFY_API_SECRET sont définis.",
  socialTitle: "Connexion sociale",
  socialSub: "Un clic avec un compte que vous avez déjà.",
  socialNotConfigured: "La connexion Google et Facebook s'active quand leurs clés client sont définies.",
  noticeConfig: "La connexion Shopify n'est pas encore configurée.",
  noticeInvalid: "Saisissez une boutique Shopify valide, par exemple votre-boutique.",
  noticeNoAccount: "Cette boutique n'est pas encore liée à un compte Temply. Créez un compte et liez la boutique.",
  noticeState: "Le lien de connexion a expiré. Réessayez.",
  noticeExchange: "Shopify n'a pas pu terminer la connexion. Réessayez.",
  noticeEmail: "Le fournisseur n'a pas partagé d'adresse e-mail, la connexion est impossible.",
  noticeSocialConfig: "Cette méthode de connexion n'est pas encore configurée.",
};

const de: AuthSocialStrings = {
  ...en,
  divider: "oder",
  shopifyTitle: "Mit Shopify anmelden",
  shopifySub: "Nutze den Shop, der bereits mit deinem Konto verbunden ist.",
  shopPlaceholder: "dein-shop",
  shopifyCta: "Weiter mit Shopify",
  shopifyNotConfigured: "Shopify-Login wird aktiv, sobald SHOPIFY_API_KEY und SHOPIFY_API_SECRET gesetzt sind.",
  socialTitle: "Social Login",
  socialSub: "Ein Klick mit einem Konto, das du schon hast.",
  socialNotConfigured: "Google- und Facebook-Login werden aktiv, sobald die Client-Schlüssel gesetzt sind.",
  noticeConfig: "Shopify-Login ist noch nicht konfiguriert.",
  noticeInvalid: "Gib einen gültigen Shopify-Shop an, zum Beispiel dein-shop.",
  noticeNoAccount: "Der Shop ist noch mit keinem Temply-Konto verbunden. Erstelle ein Konto und verbinde den Shop.",
  noticeState: "Der Login-Link ist abgelaufen. Bitte erneut versuchen.",
  noticeExchange: "Shopify konnte den Login nicht abschließen. Bitte erneut versuchen.",
  noticeEmail: "Der Anbieter hat keine E-Mail-Adresse geteilt, daher war keine Anmeldung möglich.",
  noticeSocialConfig: "Diese Anmeldemethode ist noch nicht konfiguriert.",
};

const es: AuthSocialStrings = {
  ...en,
  divider: "o",
  shopifyTitle: "Iniciar sesión con Shopify",
  shopifySub: "Usa la tienda que ya está conectada a tu cuenta.",
  shopPlaceholder: "tu-tienda",
  shopifyCta: "Continuar con Shopify",
  shopifyNotConfigured: "El acceso con Shopify se activa cuando se definen SHOPIFY_API_KEY y SHOPIFY_API_SECRET.",
  socialTitle: "Acceso social",
  socialSub: "Un clic con una cuenta que ya tienes.",
  socialNotConfigured: "El acceso con Google y Facebook se activa cuando se definen sus claves de cliente.",
  noticeConfig: "El acceso con Shopify aún no está configurado.",
  noticeInvalid: "Introduce una tienda Shopify válida, por ejemplo tu-tienda.",
  noticeNoAccount: "La tienda aún no está conectada a una cuenta de Temply. Crea una cuenta y conecta la tienda.",
  noticeState: "El enlace de acceso ha caducado. Inténtalo de nuevo.",
  noticeExchange: "Shopify no pudo completar el acceso. Inténtalo de nuevo.",
  noticeEmail: "El proveedor no compartió un correo, así que no pudimos iniciar sesión.",
  noticeSocialConfig: "Ese método de acceso aún no está configurado.",
};

const DICTS: Record<Locale, AuthSocialStrings> = { sv, nb, fi, da, en, fr, de, es };

export function getAuthSocialStrings(locale: Locale): AuthSocialStrings {
  return DICTS[locale] ?? en;
}
