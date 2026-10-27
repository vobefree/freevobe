"use client";

import { useState } from "react";
import type { Dict } from "@/lib/i18n";
import type { Locale } from "@/lib/theme/types";

export function SubscribeButton({ locale, dict, label, active = false }: { locale: Locale; dict: Dict; label: string; active?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subscribe = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        setError(json.error ?? dict.common.error);
        return;
      }
      window.location.href = json.url;
    } catch {
      setError(dict.common.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <button className="ui-btn ui-btn--accent ui-btn--lg ui-btn--block" type="button" onClick={subscribe} disabled={busy || active}>
        {active ? dict.pricing.activeBanner : busy ? dict.common.loading : label}
      </button>
      {error && <span style={{ fontSize: 11.5, color: "#a33618" }}>{error}</span>}
    </div>
  );
}
