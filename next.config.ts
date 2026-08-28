import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { version } from "./package.json";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Baked in at build time so the Settings page can say which build is
  // actually running. Without the commit, "0.1.0" is the same string for
  // every deploy and tells you nothing when something looks wrong in
  // production but not locally.
  env: {
    APP_VERSION: version,
    APP_COMMIT: (process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7),
    APP_ENV: process.env.VERCEL_ENV ?? "development",
    APP_BUILT_AT: new Date().toISOString(),
  },
  images: {
    remotePatterns: [
      {
        // Supabase Storage signed URLs for tenant photos and documents.
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // This tool holds tenant PII. None of it should ever be indexed,
          // embedded in another site, or leak referrer data outward.
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
