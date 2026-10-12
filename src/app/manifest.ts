import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Sleeve or Slab",
    short_name: "SleeveSlab",
    description: "The app that tells you when not to grade. Centering, fees, and an honest verdict for your Pokémon cards.",
    start_url: "/scan",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f4ee",
    theme_color: "#15171c",
    categories: ["utilities", "finance", "shopping"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      {
        name: "Check a card",
        short_name: "Scan",
        description: "Centering + verdict for one card",
        url: "/scan",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Binder Audit",
        short_name: "Binder",
        description: "Triage a stack of cards",
        url: "/binder",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
