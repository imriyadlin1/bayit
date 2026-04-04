import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "בית - ניהול משק בית חכם",
    short_name: "בית",
    description:
      "פלטפורמה חכמה לניהול משק הבית - הוצאות, קניות, צמחים, מטלות ועוד",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f8fafa",
    theme_color: "#0d9488",
    dir: "rtl",
    lang: "he",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
