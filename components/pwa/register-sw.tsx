"use client";

import { useEffect } from "react";

export function RegisterServiceWorker() {
  useEffect(() => {
    // En dev (Turbopack) los chunks no tienen hash de contenido como en
    // producción — un service worker cacheando assets puede servir un chunk
    // viejo aunque el código ya cambió, rompiendo el HMR de forma muy rara
    // ("module factory is not available"). Por eso el SW solo se registra
    // en producción, y en dev directamente lo desregistramos si ya estaba
    // instalado de una prueba anterior.
    if (process.env.NODE_ENV === "production") {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("/sw.js").catch((error) => {
          console.error("No se pudo registrar el service worker:", error);
        });
      }
      return;
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      });
    }
    if ("caches" in window) {
      caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
    }
  }, []);

  return null;
}
