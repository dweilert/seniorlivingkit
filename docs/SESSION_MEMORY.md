# Senior Living Kit Rebuild Session Memory

Last updated: 2026-08-01

## Repository State

- Local workspace: `/Users/bob/retirementPlannerRewriteCodeX`
- GitHub repo: `https://github.com/dweilert/seniorlivingkit`
- Repository visibility: public, changed temporarily at user request.
- Active branch: `codex/aws-rebuild`
- Open draft PR: `https://github.com/dweilert/seniorlivingkit/pull/4`
- Latest pushed commit at time of this note: `8d6de71 fix: support trailing slash page routes`
- Main branch protection is enabled with required checks `verify` and `smoke`.
- Do not merge, deploy, connect production Amplify, change DNS, or create a production release without explicit approval.

## Local Testing

- Dev server URL: `http://127.0.0.1:3001/`
- Current local server was restarted after routing changes and is running on port `3001`.
- Confirmed routes load locally:
  - `/`
  - `/about`
  - `/services`
  - `/process`
  - `/blog`
  - `/blog/`
  - `/contact`
  - `/team`
  - `/get-started`

## Completed Work

- Built a static local replacement for the current Senior Living Kit Squarespace site.
- Created pages in `public/`:
  - `index.html`
  - `about.html`
  - `services.html`
  - `process.html`
  - `blog.html`
  - `team.html`
  - `contact.html`
  - `get-started.html`
- Added local assets in `public/assets/images/` and `public/assets/fonts/`.
- Added a local dev server in `scripts/dev-server.mjs`.
- Added build, lint, unit, and browser smoke checks.
- Added GitHub Actions verification and smoke workflows.
- Added GitHub repo templates and Dependabot config.
- Harvested live-site HTML/CSS/font references under `docs/site-harvest/`.
- Updated pages to load the same Adobe Typekit kit used by the live Squarespace site.
- Updated local font stack to match harvested live site:
  - Headings: `adonis-web`
  - Body/nav/forms: `futura-pt`
  - Meta text: `Pontano Sans`
- Made local routing more robust:
  - Dev server supports extensionless and trailing-slash page routes.
  - Build output creates both flat HTML files and directory `index.html` aliases.

## Verification Status

Latest local verification passed:

- `npm run verify`
- `npm run test:browser`

Latest remote GitHub checks on PR #4 passed:

- `verify`
- `smoke`

## Image Review Findings

Reviewed source image folder:

`/Users/bob/seniorlivingkit/senior_living_kit_images`

The current local site has no broken image paths, but some harvested/live images are not yet represented in the rendered pages.

Highest priority image parity items:

- Add home-page services icon row from harvested live home page:
  - `08_Thrapy_copy_2.webp` -> Senior Housing Guidance
  - `09_Pills_copy_2.webp` -> Healthcare Navigation
  - `10_Coaching_copy.webp` -> Personalized Consultations
  - `11_Accupuncture_copy_2.webp` -> Downsizing Support
- Update blog thumbnails to match harvested blog:
  - `12_lady_80.webp`
  - `13_IMG_1402_1.webp`
  - `14_kit_headshot_resized2.webp`
- Consider using `06_unsplash-image--nn5ffUd6ZQ.webp` in the home "What makes us different?" area. The harvested live home page used this walking-path image; the local page currently uses the brand mark there.
- Consider swapping favicon to `01_favicon.webp`; current favicon is a larger logo-derived PNG.

Images already covered by equivalent local assets:

- Wordmark
- Brand mark/logo
- Home/about/services/process/get-started hero imagery
- Kit headshots
- Testimonial lady image

## Recommended Next Pick-Up

1. Copy the missing service icons and blog thumbnail images into `public/assets/images/`.
2. Insert a home-page "Our services" icon row using the four harvested service icons.
3. Replace local blog thumbnails with the harvested blog thumbnails.
4. Run:
   - `npm run verify`
   - `npm run test:browser`
5. Restart the local dev server on `3001` if server code or build behavior changes.
6. Commit and push to `codex/aws-rebuild`, then confirm PR #4 checks pass.

