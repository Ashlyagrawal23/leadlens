import type { MetadataRoute } from "next";

/** Lets Android Chrome (and desktop Chrome and Edge) install LeadLens like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LeadLens",
    short_name: "LeadLens",
    description: "See which real-estate leads matter, what the customer wants, and what to do next.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3efe6",
    theme_color: "#fffdf8",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
