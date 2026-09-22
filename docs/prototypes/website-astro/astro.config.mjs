import { defineConfig } from "astro/config";
export default defineConfig({
  site: "https://roomly-site.vercel.app",
  output: "static",
  trailingSlash: "never",
  devToolbar: { enabled: false },
});
