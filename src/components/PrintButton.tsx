"use client";

import { useRouter } from "next/navigation";

/** Skriver ut nuvarande sida (används på rapportutskriftet). */
export default function PrintButton({ label = "Skriv ut" }: { label?: string }) {
  const router = useRouter();
  return (
    <div className="row">
      <button className="btn" type="button" onClick={() => window.print()}>
        {label}
      </button>
      <button className="btn secondary" type="button" onClick={() => router.back()}>
        Tillbaka
      </button>
    </div>
  );
}
