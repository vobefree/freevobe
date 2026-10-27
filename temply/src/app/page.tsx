import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { DEFAULT_LOCALE, isLocale, LOCALES } from "@/lib/theme/types";

export default async function RootPage() {
  const jar = await cookies();
  const saved = jar.get("temply_locale")?.value;
  if (isLocale(saved)) redirect(`/${saved}`);

  const accept = (await headers()).get("accept-language") ?? "";
  const preferred = accept
    .split(",")
    .map((part) => part.split(";")[0].trim().slice(0, 2).toLowerCase())
    .find((code) => isLocale(code) && (LOCALES as readonly string[]).includes(code));

  redirect(`/${preferred ?? DEFAULT_LOCALE}`);
}
