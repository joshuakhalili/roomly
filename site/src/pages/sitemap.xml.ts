import articles from "../data/articles.json";
export function GET() {
  const paths = [
    "/",
    "/blog",
    "/contact-us",
    "/changelog",
    "/privacy-policy",
    "/terms-of-use",
    ...articles.map((p) => "/blog/" + p.slug),
  ];
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
      paths
        .map(
          (path) =>
            "<url><loc>https://roomly-site.vercel.app" + path + "</loc></url>",
        )
        .join("") +
      "</urlset>",
    { headers: { "Content-Type": "application/xml" } },
  );
}
