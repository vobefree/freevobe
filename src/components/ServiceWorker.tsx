"use client";

import { useEffect } from "react";

/** Registrerar PWA-serviceworkern (endast i webbläsaren). */
export default function ServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* ingen PWA-stöd – appen funkar ändå */
      });
    }
  }, []);
  return null;
}
