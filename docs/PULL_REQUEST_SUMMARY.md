# Build AWS-hosted Senior Living Kit replacement

## Current-site audit findings

Observed public pages include Home, Services, Process, About, and Get Started. Core messaging centers on senior living guidance, placement services, consulting services, Central Texas coverage, and a free consultation call-to-action.

## Application architecture

This first stage is a dependency-light static site with Node-based verification scripts. It is designed to be portable to AWS static hosting and to keep provider integrations mocked until credentials, ownership, and compliance requirements are approved.

## Existing AWS resources discovered

No AWS account inspection was performed and no AWS resources were deployed.

## Pages implemented

- Home
- Services
- Process
- About
- Get Started

## Content migrated

Primary public-page messages, service categories, process steps, consultation CTA, mission, vision, founder positioning, and service pricing language were migrated from indexed public content.

## Form and integration behavior

The consultation form validates required fields in the browser and displays a local mock confirmation. It does not submit to Mailchimp, Twilio, SES, AWS, Interact, Acuity, Calendly, or any production API.

## Accessibility work

Pages include semantic landmarks, labeled form controls, visible focusable links/buttons, responsive layout, and status messaging with `role="status"` and `aria-live`.

## Tests and actual results

Local results on August 1, 2026:

- `npm ci`: passed
- `npm run verify`: passed
- `npm run test:browser`: passed when allowed to bind a local `127.0.0.1` smoke-test server

## Infrastructure-as-code added

No deployable infrastructure was added in this stage. GitHub-to-AWS OIDC design is documented in `docs/GITHUB_AWS_OIDC.md`.

## Security and privacy controls

- `.gitignore` excludes common secrets and credential files.
- `.env.example` contains placeholders only.
- GitHub Actions use minimal default permissions.
- No long-lived AWS credentials were created or stored.

## Known limitations

- Blog pages are not migrated because source exports were not available.
- Real provider integrations are intentionally disabled.
- Repository branch protection must be configured after CI checks exist.

## Decisions still required

See `docs/RISKS_AND_OPEN_DECISIONS.md`.

## AWS resources proposed but not deployed

Future staging and production OIDC roles are proposed, with separate staging and production trust boundaries.

## Deployment and DNS changes not performed

No production AWS deployment occurred. No production DNS changes occurred. The existing Squarespace site remains unchanged.
