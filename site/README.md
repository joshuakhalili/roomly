# Roomly website

A photograph-led, static Astro website for Roomly. The site presents product features; portfolio/demo context is kept in repository documentation, not public product screens.

```sh
npm ci
npm run dev
npm run build
npm run preview
```

Node.js 24. No credentials, database or backend is required. `Request access` opens an email draft; `Log in` opens the existing Roomly application. There is no simulated form submission or paid checkout.

## Source

- `src/layouts/Base.astro`: metadata, navigation, footer and restrained section reveals.
- `src/styles/site.css`: responsive layout, focus treatment and reduced motion.
- `src/pages`: home, six articles, article index, contact, updates, privacy, terms and 404.
- `src/data`: editable article content, release summaries and shared destination URLs.
- `public/images`: local photographs and genuine application screenshots.

All previous public page paths are preserved. The existing website's author-owned article content was migrated from commit `02a409f` in the local `roomly-site` repository. Its original checkout and history remain intact. This build does not copy the prior PipelinePro template runtime, layout or reset scripts. Changes to former demo-specific public copy follow the owner's September 2026 direction to keep that context in GitHub documentation.

Pricing and plan allocations in the old presentation were invented, as recorded in its source notes. This site offers access by enquiry and does not assert subscription entitlements or accept payment. UK document categories describe record organisation, not Roomly accreditation or legal compliance certification. Reference: [GOV.UK landlord safety responsibilities](https://www.gov.uk/private-renting/your-landlords-safety-responsibilities).

## Photography and screenshots

| Asset                   | Credit and source                                                                                                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shared-home.jpg`       | [cottonbro studio — Women and Men in Kitchen](https://www.pexels.com/photo/women-and-men-in-kitchen-5146884/)                                                                          |
| `shared-kitchen.jpg`    | [Gustavo Fring — People Preparing Food](https://www.pexels.com/photo/people-preparing-food-7489001/)                                                                                   |
| Application screenshots | Existing Roomly screenshots, captured 4 September 2026 using fictional review data. Original files retained under repository documentation. The website frames out the account header. |

Photographs are used under the [Pexels licence](https://www.pexels.com/license/), checked 21 September 2026. They depict lifestyle scenes, not Roomly users, customers, endorsements or testimonials. Do not add customer quotes or endorsements to these photographs.

## Deploy

Vercel project root: `site`. Framework: Astro. Install: `npm ci`. Build: `npm run build`. Output: `dist`. Deploy separately from the app. The source includes `vercel.json`; linking the existing Vercel website project to this repository/root remains a release step. No live deployment is implied by a local build.

The site uses no analytics scripts, advertising cookies or externally loaded fonts. Product screenshots may contain fictional occupancy or financial figures; those are interface examples, not adoption or performance claims.

Typography: Instrument Sans, distributed under the SIL Open Font License. The licence ships in `public/fonts/INSTRUMENT-SANS-LICENSE.txt`. Run `npm run format` to format Astro, CSS, TypeScript and content files.
