# Screen And Data Backlog

Last updated: 2026-08-09

This backlog converts the reference screenshots in `/Users/bob/@senior` into
screens we need to build and the data each screen requires.

## Primary Screens

| Screen | Purpose | Main Data |
| --- | --- | --- |
| Client Pipeline | Track active leads by stage from new inquiry through placement/closed. | `leads`, `lead_statuses`, `lead_status_history`, `tasks` |
| Client Workspace | Full lead/client command center. | `leads`, `people`, `lead_people`, `person_relationships`, `communications`, `tasks`, `entity_files` |
| Client Intake | Capture resident, family, urgency, budget, care needs, location, payor, and notes. | `leads`, `people`, `lead_people`, `custom_field_values` |
| Relationship Map | Show family, friends, doctors, advisors, and facility contacts around a client. | `people`, `person_relationships`, `lead_people` |
| Assessment | Structured care/lifestyle/budget/location questions used for fit scoring. | `assessment_templates`, `assessment_questions`, `lead_assessments`, `assessment_answers` |
| Community Search | Search and map facilities/communities with filters. | `facilities`, `facility_profiles`, `facility_contacts`, `facility_pricing_updates`, `facility_availability_updates` |
| Community Detail | Show facility details, contacts, amenities, care levels, pricing, availability, source history. | `facilities`, `facility_profiles`, `facility_contacts`, `facility_source_runs` |
| Client Community Options | Track potential/referred/toured/selected/declined communities for a client. | `lead_community_options`, `tours`, `communications`, `tasks` |
| Community Comparison | Side-by-side reportable comparison for a client/family. | `community_report_packages`, `community_report_items`, `lead_community_options`, `facility_profiles` |
| Tasks | Queue work by due date, assignee, type, and client/community. | `tasks`, `task_types`, `app_users`, `leads`, `facilities` |
| Calendar | View tours, follow-ups, calls, assessments, and deadlines by date. | `calendar_events`, `tasks`, `tours`, `leads`, `facilities` |
| Messaging | Inbox/thread view for email/text/internal messages. | `communication_threads`, `communications`, `email_templates`, `integration_events` |
| Files | Uploaded/generated files attached to clients, facilities, forms, or reports. | `entity_files`, `form_submissions`, `community_report_packages` |
| Reports | Saved report definitions, generated report packages, and operational dashboards. | `report_definitions`, `community_report_packages`, aggregate views |
| Forms | Printable/custom forms and submitted form records. | `form_templates`, `form_submissions`, `entity_files` |
| Referrals | Referral source directory and performance. | `referral_sources`, `leads`, `communications`, `invoices` |
| Invoices And Payments | Placement billing and payment tracking. | `invoices`, `invoice_items`, `payments`, `integrations` |
| Signatures | Signature template/request management. | `signature_templates`, `signature_requests`, `entity_files` |
| Admin Settings | Tenant, users, roles, templates, custom fields, workflows, integrations. | `tenants`, `app_users`, `tenant_users`, `custom_fields`, `workflow_definitions`, `integrations` |

## First Build Slice

The highest-value next frontend slice is:

1. Replace the current CRM tab with a real client workspace shell.
2. Add tabs inside the workspace: `Overview`, `People`, `Assessment`,
   `Communities`, `Activity`, `Tasks`, `Files`.
3. Move the existing lead form, relationship graph, communications, and linked
   facilities into those tabs.
4. Add a community option status workflow using `lead_community_options`.
5. Add sample assessment data using the new assessment tables.

## Mobile And Tablet Requirements

- Left navigation collapses to bottom tabs or a drawer.
- Client workspace tabs become horizontally scrollable segmented tabs.
- Community search becomes stacked: filters, map, list, detail.
- Tables need card/list alternatives under tablet width.
- Action buttons should stay visible near the current record, not only in a top
  toolbar.

## Data Model Gaps Closed By Migration 005

Migration `005_screen_driven_product_model.sql` adds:

- assessment templates/sections/questions
- lead assessment instances and answers
- generic printable/custom form templates and submissions
- generic entity file attachments
- richer facility/community profile metadata
- community comparison report packages and report items
- communication threads
- generic calendar events

## Remaining Model Gaps

- Tenant-scoped facility preferences still need a durable table.
- Website discovery at scale still needs a queue/run table and S3 snapshot URI
  conventions.
- Real OCR/business-card extraction needs storage, provider metadata, field
  review state, and accepted/rejected field decisions.
- Role/permission policies need explicit screens and enforcement in the backend.
