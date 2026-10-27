"use client";

import { useEffect, useState } from "react";

/** Räknar upp från en ISO-tidsstämpel: "2 tim 15 min" som uppdateras var sekund. */
export default function Elapsed({ from, prefix }: { from: string; prefix?: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const start = new Date(from).getTime();
  const minutes = now === null ? 0 : Math.max(0, Math.floor((now - start) / 60000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const text = hours > 0 ? `${hours} tim ${rest} min` : `${rest} min`;

  return (
    <span className="nowrap">
      {prefix ? `${prefix} ` : ""}
      {now === null ? "…" : text}
    </span>
  );
}
