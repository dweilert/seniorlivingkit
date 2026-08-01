# Risks and Open Decisions

- `main` branch protection was enabled after the repository was made public at owner request. Required checks are `verify` and `smoke`; force pushes and branch deletion are blocked; pull requests and resolved conversations are required.
- Select the production scheduling provider and approved embed URL.
- Confirm Mailchimp audience, tags, and consent language.
- Confirm whether SMS will be used and complete Twilio compliance work before enabling it.
- Confirm Interact quiz ownership and embed settings.
- Obtain source exports for blog content if blog migration is required.
- Approve staging AWS infrastructure before any deployment workflow is added.
- Approve production DNS cutover separately from this rebuild.
