import type { Locale } from "@/lib/theme/types";

/**
 * Strängar för värvningsprogrammet. Svenska och engelska är översatta; övriga
 * språk faller tillbaka på engelska så att panelen aldrig blockerar en release.
 */
export type ReferralStrings = {
  title: string;
  sub: string;
  code: string;
  link: string;
  copy: string;
  copied: string;
  invited: string;
  paying: string;
  earned: string;
  remaining: string;
  rule: string;
  disabled: string;
  field: string;
  fieldHint: string;
  fieldApplied: string;
  fieldUnknown: string;
};

const en: ReferralStrings = {
  title: "Invite and earn free months",
  sub: "Share your link. You both get rewarded, only when your friend starts paying.",
  code: "Your code",
  link: "Your invite link",
  copy: "Copy link",
  copied: "Link copied",
  invited: "signed up",
  paying: "paying",
  earned: "free days earned",
  remaining: "of {max} rewards left",
  rule: "Your friend gets {bonus} extra trial days. You get {reward} free days when they start paying. Max {max} rewards per account.",
  disabled: "The invite programme is paused right now.",
  field: "Invite code (optional)",
  fieldHint: "Have a friend who invited you? Enter their code and you both get extra days.",
  fieldApplied: "Code applied — you get {bonus} extra trial days when you create the account.",
  fieldUnknown: "We could not find that code. Check the spelling.",
};

const sv: ReferralStrings = {
  title: "Bjud in och få gratismånader",
  sub: "Dela din länk. Båda belönas – men först när din vän börjar betala.",
  code: "Din kod",
  link: "Din inbjudningslänk",
  copy: "Kopiera länk",
  copied: "Länken är kopierad",
  invited: "har skapat konto",
  paying: "betalar",
  earned: "gratisdagar intjänade",
  remaining: "av {max} belöningar kvar",
  rule: "Din vän får {bonus} extra provdagar. Du får {reward} gratisdagar när hen börjar betala. Max {max} belöningar per konto.",
  disabled: "Värvningsprogrammet är tillfälligt pausat.",
  field: "Värvningskod (frivilligt)",
  fieldHint: "Har du blivit inbjuden? Fyll i koden och ni får båda extra dagar.",
  fieldApplied: "Koden är registrerad — du får {bonus} extra provdagar när kontot skapas.",
  fieldUnknown: "Vi hittade ingen kod med den stavningen.",
};

export function getReferralStrings(locale: Locale): ReferralStrings {
  return locale === "sv" ? sv : en;
}
