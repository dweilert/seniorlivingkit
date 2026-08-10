# Current Site Audit

Source reviewed: public pages crawled from `seniorlivingkit.com` on August 1, 2026.

## Pages Observed

- Home: hero message "Guiding You Home.", service overview, quiz call-to-action, blog links, consultation call-to-action, newsletter prompt.
- Services: placement services, consulting services at $150/hour, geographic focus in Central Texas, family testimonials.
- Process: four-step path covering connect, explore options, expert guidance, and transition support.
- About: mission, vision, founder story for Kit Baumann.
- Get Started: consultation booking call-to-action.
- Contact: email and phone call-to-action.
- Blog: blog index and visible post cards/excerpts.
- Team: public team route with limited visible content.

## Assets Harvested

- Logo/wordmark, brand mark, favicon, founder headshots, hero imagery, testimonial imagery, and blog imagery were harvested from public Squarespace CDN URLs into `public/assets/images/`.
- Pontano Sans and Montserrat Squarespace font files were harvested into `public/assets/fonts/` and wired through local `@font-face` rules.
- Raw crawled HTML and extracted page text are stored under `docs/site-harvest/`.

## Migration Notes

- The current implementation preserves the public-page structure, primary calls to action, navigation, footer language, local fonts, and site imagery closely enough for pre-deployment local testing.
- Real quiz, scheduling, newsletter, SMS, and CRM behavior remains behind provider interfaces or placeholders until account ownership and compliance decisions are confirmed.
- Full blog-post detail migration still depends on source export or deeper content approval, but the public blog index and visible excerpts are represented locally.
