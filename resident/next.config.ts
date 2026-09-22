import type { NextConfig } from "next";
import { environment } from "./lib/env";
environment();
const config: NextConfig = {
  agentRules: false,
  devIndicators: false,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  serverExternalPackages: ["node:sqlite"],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};
export default config;
