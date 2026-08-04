# Integrations Research

This note captures researched integration capabilities and policy links so we do
not have to rediscover vendor requirements later. Re-check vendor docs before
implementation because API policies, app review, and rate limits can change.

## QuickBooks Online / Intuit

Reviewed: 2026-08-03

Official docs and policies:

- QuickBooks Online API docs: https://developer.intuit.com/app/developer/qbo/docs/learn
- OAuth scopes: https://developer.intuit.com/app/developer/qbo/docs/learn/scopes
- Intuit Developer Terms of Service: https://developer.intuit.com/app/developer/qbo/docs/legal-agreements/intuit-terms-of-service-for-intuit-developer-services
- Production credentials: https://developer.intuit.com/app/developer/qbo/docs/get-started/get-client-id-and-client-secret
- Publish app: https://developer.intuit.com/app/developer/qbo/docs/go-live/publish-app
- App Store listing: https://developer.intuit.com/app/developer/qbo/docs/go-live/list-on-the-app-store
- App review process: https://developer.intuit.com/app/developer/qbo/docs/go-live/list-on-the-app-store/what-to-expect-during-the-review
- Technical requirements: https://developer.intuit.com/app/developer/qbo/docs/go-live/publish-app/technical-requirements
- Platform requirements: https://developer.intuit.com/app/developer/qbo/docs/go-live/publish-app/platform-requirements
- API call limits and throttles: https://developer.intuit.com/app/developer/qbo/docs/learn/limits-and-throttles

Relevant capabilities for this CRM:

- OAuth 2.0 per tenant/customer connection.
- QuickBooks Online Accounting API for customers, invoices, payments, vendors,
  items, and accounting sync.
- Main accounting scope: `com.intuit.quickbooks.accounting`.
- OpenID Connect scopes can provide user profile/email/phone/address data when
  needed.
- Production keys require Intuit production app questionnaire/approval.
- QuickBooks App Store listing is optional for private distribution, but public
  listing requires technical, security, and marketing review.

Architecture implications:

- Store one QuickBooks connection per tenant/company realm.
- Persist Intuit realm/company ID, granted scopes, token expiry, refresh-token
  metadata, and disconnect status.
- Keep QuickBooks IDs on synced records such as customers, invoices, invoice
  items, payments, and vendors.
- Treat QuickBooks as the source of truth for invoice/payment status after sync.
- Keep an integration event/audit log for every outbound create/update and every
  inbound status refresh.
- Implement disconnect/reconnect UX and token refresh error handling.
- Respect published throttles; current REST docs list 500 requests/minute per
  realm ID and 10 requests/second per realm ID and app.

Likely first implementation:

1. Connect tenant to QuickBooks with OAuth.
2. Map CRM person/lead payer to QuickBooks customer.
3. Create invoice from placement fee record.
4. Refresh invoice and payment status.
5. Store sync events and user-visible error states.

## Constant Contact

Reviewed: 2026-08-03

Official docs and policies:

- V3 API technical overview: https://developer.constantcontact.com/api_guide/v3_technical_overview.html
- V3 API reference: https://developer.constantcontact.com/api_reference/index.html
- OAuth2 overview: https://developer.constantcontact.com/api_guide/auth_overview.html
- Authorization scopes: https://v3.developer.constantcontact.com/api_guide/scopes.html
- Rate limits: https://v3.developer.constantcontact.com/api_guide/rate_limits.html
- API terms and conditions: https://v2.developer.constantcontact.com/home/api-terms-and-conditions.html
- Quick start guide: https://developer.constantcontact.com/api_guide/getting_started.html
- Technology partner overview: https://developer.constantcontact.com/api_guide/partners_overview.html
- Technology partner registration: https://developer.constantcontact.com/api_guide/partners_reg_creds.html
- Technology partner developer account: https://developer.constantcontact.com/api_guide/partners_dev_accts.html

Relevant capabilities for this CRM:

- REST/JSON V3 API at `https://api.cc.email/v3`.
- OAuth 2.0 is required for V3 API access.
- Standard account endpoints can support contact sync, contact lists, custom
  fields, segments, bulk activities, email campaigns, and campaign/contact
  reporting.
- Useful scopes:
  - `offline_access` for refresh-token support.
  - `account_read` / `account_update` for account endpoints.
  - `contact_data` for contacts, contact lists, custom fields, activities,
    segments, and contact reporting.
  - `campaign_data` for email campaigns and email reporting.
- Access tokens are bearer tokens. The OAuth docs state access tokens expire
  after 1,440 minutes / 86,400 seconds / 24 hours.
- Refresh tokens should only be used when the existing access token is expired
  or about to expire; Constant Contact rate-limits the token endpoint.
- Published V3 rate limits are 10,000 requests per day per API key and 4
  requests per second. Exceeded limits return HTTP 429.
- Partner endpoints require approval as a Constant Contact Technology Partner
  and separate partner credentials. Partner endpoints are for creating and
  managing Constant Contact client accounts under a partner account.

Architecture implications:

- Treat Constant Contact as a per-tenant OAuth integration.
- Store Constant Contact account ID/metadata, granted scopes, token expiry,
  refresh-token metadata, disconnect status, and last sync timestamps.
- Sync CRM people/referral contacts/leads into Constant Contact contacts and
  lists only when the tenant explicitly enables that mapping.
- Maintain list IDs for audiences such as prospects, family contacts, referral
  partners, facilities, and newsletter subscribers.
- Use custom fields for CRM-specific attributes only after a tenant mapping is
  configured.
- Store Constant Contact contact IDs, list membership IDs, campaign IDs, and
  reporting snapshots on local integration mapping tables.
- Respect unsubscribe/permission status. Constant Contact should remain the
  source of truth for email opt-out status once synced.
- Keep outbound sync events and inbound reporting refreshes in
  `integration_events` for audit and retry.

Likely first implementation:

1. Connect tenant to Constant Contact with OAuth.
2. Pull account metadata and existing lists.
3. Let tenant map CRM segments to Constant Contact lists.
4. Push opted-in CRM contacts to selected lists.
5. Pull unsubscribe/contact status and campaign engagement snapshots.
6. Later, create campaigns from approved CRM templates if product scope calls
   for outbound marketing inside the app.
