import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Compound Blue",
    short_name: "Compound",
    description: "DeFi lending and borrowing interface for Compound-managed deployments on the Morpho protocol.",
    start_url: "/",
    icons: [
      {
        src: "/web-app-manifest-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/web-app-manifest-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    display: "standalone",
    background_color: "#0D131A",
    theme_color: "#0D131A",
  };
}
