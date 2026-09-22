# Roomly website

The existing Framer website, preserved and integrated into the Roomly repository. The original layout, responsive variants, scroll entrances, ticker, FAQ and monthly/yearly pricing interactions remain in place.

```sh
npm ci
npm run dev          # http://127.0.0.1:4321
npm run check
npm run build
npm run preview
```

Node.js 24. No cloud credentials or runtime packages are required for the build.

## Editing safely

- `source/`: immutable imported mirror of `roomly-site` at `02a409f`; includes the original Framer runtime and its routing/range-loader hardening. Do not edit generated files here.
- `content.json`: exact editorial replacements applied to HTML, JavaScript and JSON in one longest-first pass.
- `public/roomly.css`: shared violet brand tokens and responsive editorial additions. Do not neutralise Framer layout transforms.
- `public/roomly.js`: additive shared-home photography, skip link and accessibility semantics. Framer retains control of its interactions.
- `public/assets/images/`: updated product screenshots fitted to the original template slots.
- `scripts/build.mjs`: repeatable source → `dist` build. Never resets Git or edits the original checkout.
- `scripts/serve.mjs`: clean, slashless URLs and actual 404 responses for local verification.

The earlier Astro rebuild is preserved in `../docs/prototypes/website-astro`. It is not the deployed website. All 13 original public routes remain available. The fictional portfolio counter band is excluded from marketing; no customer statistics or accreditations are claimed.

## Photography and presentation

- `shared-home.jpg`: [cottonbro studio — Women and Men in Kitchen](https://www.pexels.com/photo/women-and-men-in-kitchen-5146884/).
- `shared-kitchen.jpg`: [Gustavo Fring — People Preparing Food](https://www.pexels.com/photo/people-preparing-food-7489001/).

Licensed under the [Pexels licence](https://www.pexels.com/license/), checked 21 September 2026. People depicted are not presented as Roomly customers or endorsers. Product images use the fictional review organisation. Portfolio/demo context belongs here and in the main README, not in product banners.

Starter, Standard and Portfolio presentation prices remain £29/£79/£149 monthly and £290/£790/£1,490 yearly. These are existing presentation amounts, not implemented payment plans or evidence of commercial launch. Access enquiries open an email draft; no payment or external message is sent automatically. Management login is separate from the resident application.

## Deploy

Deploy to the existing `roomly-site` Vercel project with **Other** as the framework, `npm run build` as build command and `dist` as output directory. The project is configured with root directory `site` for Git-based deployments. When deploying manually after linking, run from the repository root with the website project ID; do not prepend `site` twice. The management app deploys separately from the repository root. No database migration is part of a website deployment.
