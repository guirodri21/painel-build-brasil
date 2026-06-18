import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Build Brasil — Painel de Resultados",
    short_name: "Build Brasil",
    description: "Sistema de gestão de resultados — Build Brasil Engenharia",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0d12",
    theme_color: "#2563eb",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
