import type { MetadataRoute } from "next";

// Keep crawlers off signed-in, per-student, and API routes.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/admin",
        "/dashboard",
        "/onboarding",
        "/profile",
        "/u/",
        "/verify",
      ],
    },
  };
}
