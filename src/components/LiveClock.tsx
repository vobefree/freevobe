"use client";

import { useEffect, useState } from "react";

/** Visar aktuell klocka (svensk tid) som uppdateras var sekund. */
export default function LiveClock() {
  const [now, setNow] = useState<string | null>(null);

  useEffect(() => {
    const tick = () =>
      setNow(
        new Intl.DateTimeFormat("sv-SE", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hourCycle: "h23",
          timeZone: "Europe/Stockholm",
        }).format(new Date()),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return <span className="nowrap">{now ?? "…"}</span>;
}
