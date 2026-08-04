# SeniorPlace Documentation Review

Reviewed: 2026-08-03

Source: https://docs.seniorplace.io/

This captures the SeniorPlace documentation review so we can reuse it while
designing the new facility intelligence and CRM product. The goal is not to
copy SeniorPlace, but to understand the practical data model and workflows that
a senior placement CRM is expected to support.

## Documentation Coverage

The public docs are organized around:

- Clients
- Communities
- Custom Reports
- Email Management
- General
- Getting Started
- Invoices and Payments
- Referrals
- SignWise
- Tasks
- Users
- Premium

This indicates the product is broader than a contact manager. It combines lead
management, community matching, referral management, task discipline, email,
invoicing, reporting, e-signature, and premium automation/integration features.

## Real Capabilities Observed

### Clients and Intake

- Add and manage client profiles.
- Move clients across configurable pipeline/status stages.
- Detect potential duplicate clients by similar client or best-contact name.
- Start a new move process by duplicating a client into a new active status.
- Upload a paper intake form in premium; AI fills client profile fields.
- Add custom fields to client, community, and referral records.
- Add collaborators to a client in premium without changing assigned ownership.

### Communities and Matching

- Search for ideal communities from inside the client profile.
- Filter communities by type, location, pricing, and other match criteria.
- Add communities as potential matches for a client.
- Exclude communities for a specific client and later restore them.
- Maintain community records sourced from official state licensing data.
- Store community name, address, license types, license number, administrator,
  phone, and capacity when the state source provides it.
- Show Google reviews and contact-provided pricing/availability in an Insights
  area.
- Update sourced community information about every 30 days.
- Allow manually added communities when official sources do not include them.
- Generate shareable community comparisons by live link and PDF.
- Customize comparison sections and fields agency-wide and per client email.

### Pricing and Availability

- Request pricing and availability from community profiles, client match lists,
  community options, and referral email workflows.
- Track vacancy yes/no, availability notes, last updated date, and price range.
- Filter community lists by vacancy where availability is known.
- Refresh enrolled community contacts on a recurring weekly basis.

### Referrals

- Hosted intake forms can be embedded or shared by direct link.
- New intake submissions can be assigned to users and trigger notifications.
- Premium supports multiple referral forms, edited layouts, and custom links.
- Track referral organizations and referral contacts.
- Report inbound and outbound referral metrics.
- Support referral pipelines and tiers.
- Support business-card scanning for referral contacts and organizations.

### Email and Communications

- Supports direct email sending with DNS configuration.
- Supports reusable email and signature templates with placeholders and
  attachments.
- Premium can sync Gmail or Microsoft mailbox conversations.
- Sent emails are visible from client profiles.
- Email/link open tracking is a premium capability.

### Tasks and Follow-Up

- Tasks can attach to clients, communities, and referrals.
- Task fields include title, due date/time, task type, assignee, notes, and
  recurrence.
- Task views support active/completed filtering and search.
- Client lists show next-task urgency.
- There is an "entities without tasks" view for active clients and referral
  records.
- Premium can auto-create tasks from status changes and inactivity rules.

### Users and Permissions

- Built-in roles include Administrator, Power User, Basic User, Independent
  User, Restricted User, and Custom User.
- Permissions control visibility and actions such as export, reports,
  community details, settings, SignWise templates, and user administration.
- Custom permissions are a premium capability.

### Reports

- Custom reports support record type, conditions, advanced groups, selected
  columns, saved reports, sharing, exporting, and scheduled delivery.
- Premium adds unlimited saved reports and report scheduling.

### Invoices and Payments

- Create invoice records with status, number, sent date, due date, items,
  payments, notes, and an external invoice link.
- Email and download invoice PDFs.
- QuickBooks Online integration is available.

### SignWise

- Create e-signature templates from PDF/files.
- Define sender fields, recipient fields, multiple recipients, CCs, reminders,
  and request/completion emails.
- Track signature request status, resend/cancel/duplicate requests, and attach
  signed documents back to related records.

### Premium Automations and Integrations

Premium capabilities include:

- referral source follow-up email
- move-in follow-up email
- create task on client status change
- send email on client status change
- task to re-engage inactive client
- task for clients not worked recently
- email/task when check-back-later date arrives
- notify unselected communities after placement
- QuickBooks Online
- Constant Contact
- Mailchimp
- Zapier
- mailbox sync
- AI intake upload
- client collaborators

## Inferred Data Model

The docs imply these major entities:

- `tenants` / agencies
- `offices` or markets
- `users`
- `roles`
- `permissions`
- `clients`
- `client_statuses`
- `client_status_history`
- `client_moves`
- `client_collaborators`
- `client_files`
- `custom_fields`
- `custom_field_values`
- `communities`
- `community_license_types`
- `community_contacts`
- `community_attributes`
- `community_insights`
- `community_pricing_updates`
- `community_availability_updates`
- `client_community_options`
- `excluded_communities`
- `tours`
- `referral_organizations`
- `referral_contacts`
- `client_referral_sources`
- `outbound_referrals`
- `tasks`
- `task_types`
- `communications`
- `email_templates`
- `invoices`
- `invoice_items`
- `payments`
- `signature_templates`
- `signature_requests`
- `reports`
- `report_conditions`
- `workflows`
- `workflow_runs`
- `integrations`
- `integration_events`
- `audit_log`

## Product Implications for Our Build

Our current prototype already points in the right direction with facility data,
map search, source lineage, CRM leads, communications, tasks, people, and a
relationship graph. The next durable backend work should add the missing
placement-specific structures:

- tenant-specific lead status definitions
- lead status history
- client/community option lifecycle
- client-specific excluded facilities
- tours
- pricing and availability snapshots with provenance
- custom fields and values
- task types
- email templates
- report definitions
- workflow definitions and workflow run history
- invoice/payment skeleton
- signature request skeleton

The relationship graph should remain a differentiator. SeniorPlace-style CRM
features track the placement process well, but our app can make family,
advisor, doctor, facility contact, and referral influence easier to see and act
on.

## Source Links

- https://docs.seniorplace.io/
- https://docs.seniorplace.io/article/64-how-to-add-a-new-client
- https://docs.seniorplace.io/article/29-updating-client-status
- https://docs.seniorplace.io/article/163-how-to-input-client-information-using-the-paper-client-intake-form
- https://docs.seniorplace.io/article/84-how-to-start-the-new-move-process
- https://docs.seniorplace.io/article/41-how-to-find-and-add-ideal-communities-for-a-client
- https://docs.seniorplace.io/article/78-what-community-information-does-senior-place-obtain
- https://docs.seniorplace.io/article/19-how-to-exclude-communities-for-a-client
- https://docs.seniorplace.io/article/168-how-to-request-and-view-community-availability-information
- https://docs.seniorplace.io/article/174-how-to-request-and-view-community-pricing-information
- https://docs.seniorplace.io/article/38-how-to-email-community-comparisons-to-clients
- https://docs.seniorplace.io/article/60-how-to-customize-community-comparisons
- https://docs.seniorplace.io/article/67-how-to-add-and-edit-custom-fields
- https://docs.seniorplace.io/article/167-how-to-add-and-remove-client-collaborators
- https://docs.seniorplace.io/article/90-what-to-do-when-a-potential-duplicate-client-is-detected
- https://docs.seniorplace.io/article/52-how-to-embed-a-client-intake-form-on-your-website
- https://docs.seniorplace.io/article/55-how-to-see-inbound-outbound-referral-metrics
- https://docs.seniorplace.io/article/63-how-to-set-up-direct-email-dns
- https://docs.seniorplace.io/article/36-how-to-create-and-edit-an-email-or-signature-template
- https://docs.seniorplace.io/article/178-how-to-set-up-mailbox-sync
- https://docs.seniorplace.io/article/11-how-to-see-emails-youve-sent-to-a-client
- https://docs.seniorplace.io/article/12-task-management-overview
- https://docs.seniorplace.io/article/66-permission-levels-explained
- https://docs.seniorplace.io/article/71-what-can-senior-place-premium-do-for-me
- https://docs.seniorplace.io/article/110-how-to-connect-senior-place-with-quickbooks-online
- https://docs.seniorplace.io/article/57-how-to-create-a-custom-report
- https://docs.seniorplace.io/article/44-how-to-export-data-from-senior-place
- https://docs.seniorplace.io/article/86-how-to-create-and-send-an-invoice
- https://docs.seniorplace.io/article/49-learn-how-to-create-send-and-monitor-signwise-requests
