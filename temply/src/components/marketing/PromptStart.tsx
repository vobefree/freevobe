"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Dict } from "@/lib/i18n";
import { Icon } from "@/components/Icon";
import type { Locale } from "@/lib/theme/types";

export function PromptStart({ locale, dict, loggedIn }: { locale: Locale; dict: Dict; loggedIn: boolean }) {
  const [value, setValue] = useState("");
  const router = useRouter();

  const start = (prompt: string) => {
    const text = prompt.trim();
    if (!text) return;
    try {
      localStorage.setItem("temply_prompt", text);
    } catch {
      /* ignore storage errors */
    }
    router.push(loggedIn ? `/${locale}/dashboard?new=1` : `/${locale}/signup`);
  };

  return (
    <>
      <form
        className="prompt-bar"
        onSubmit={(event) => {
          event.preventDefault();
          start(value);
        }}
      >
        <Icon name="sparkles" size="md" tone="muted" />
        <input value={value} onChange={(event) => setValue(event.target.value)} placeholder={dict.landing.promptPlaceholder} aria-label={dict.landing.promptPlaceholder} />
        <button className="ui-btn ui-btn--accent" type="submit">
          {dict.landing.promptCta}
          <Icon name="arrowRight" size="sm" strokeWidth={2} />
        </button>
      </form>
      <div className="chips">
        {dict.landing.chips.map((chip) => (
          <button type="button" className="chip" key={chip} onClick={() => start(chip)}>
            {chip}
          </button>
        ))}
      </div>
    </>
  );
}
