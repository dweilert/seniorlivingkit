# Senior Living Kit Rebuild

Static first-stage rebuild of SeniorLivingKit.com for a future AWS-hosted launch. This repository currently includes public marketing pages, mock-only form handling, GitHub governance files, CI, and deployment planning docs.

## Local Development

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`.

## Verification

```bash
npm run verify
npm run test:browser
```

The current implementation intentionally uses mock providers only. It does not call Mailchimp, Twilio, SES, AWS, Interact, Acuity, Calendly, or any production system.

## Deployment Status

No production AWS deployment has been performed. No production DNS has been changed. The existing Squarespace site remains unchanged.
