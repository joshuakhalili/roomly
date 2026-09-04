import type { MetadataRoute } from "next";

/**
 * Web app manifest — what makes "Add to Home Screen" produce a real app icon
 * with no browser chrome. iOS also needs the apple-specific meta tags, which
 * are set in [locale]/layout.tsx; both are required together.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Roomly",
    short_name: "Roomly",
    description: "Private property management tool",
    start_url: "/en",
    display: "standalone",
    background_color: "#F6F4EF",
    theme_color: "#14120F",
    orientation: "portrait",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
