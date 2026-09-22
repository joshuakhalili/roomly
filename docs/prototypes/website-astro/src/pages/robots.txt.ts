export function GET() {
  return new Response(
    "User-agent: *\nAllow: /\nSitemap: https://roomly-site.vercel.app/sitemap.xml\n",
    { headers: { "Content-Type": "text/plain" } },
  );
}
