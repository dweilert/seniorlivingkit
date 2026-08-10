# Senior Living CRM Requirements

This note captures the CRM feature direction for the senior living placement
system. It should be revisited as the prototype evolves into a multi-tenant,
multi-user web application.

## Product Positioning

The system should not be a generic CRM with a facility list attached. The
differentiator should be the combination of:

- facility intelligence
- family and influencer relationship CRM
- senior living placement workflow
- communication and follow-up discipline
- source-aware facility/contact data

## Core CRM Features

1. Prospect and lead management

- resident/prospect profile
- family/influencer relationships
- care needs, budget, timing, geography, preferences
- lead source attribution
- pipeline statuses such as inquiry, contacted, assessment, touring,
  application, move-in/placed, and closed
- next-step reminders and task ownership

2. People and relationship graph

- resident, family, friends, physicians, attorneys, referral sources, facility
  contacts, and advisors
- relationship type and influence level
- decision-maker versus information-only contacts
- consent and communication preference per person
- graph view showing people one or more levels away from the selected person
- filters for relationship type, distance, age range, and other future traits

3. Facility matching

- search by location, care level, capacity, price range when available,
  rating/quality, availability, special care, and distance
- priority, exclude, and shortlist controls
- side-by-side facility comparison
- fit notes per lead/facility
- tour status, application status, and availability status

4. Communication hub

- calls, emails, texts, and notes
- communication history across prospect, family, referral source, and facility
- reusable templates
- automated reminders
- future email, SMS, and phone integration

5. Tour and move-in workflow

- tour scheduling
- post-tour feedback
- document checklist
- application packet tracking
- move-in target date
- lost/closed reason

6. Referral source management

- hospitals, discharge planners, physicians, elder law attorneys, churches, and
  social workers
- referral source contact history
- conversion by referral source
- relationship health and last-touch tracking

7. Reporting

- lead volume by source
- conversion by stage
- tour-to-move-in rate
- average days in pipeline
- lost reasons
- facility recommendation frequency
- occupancy and availability if integrated later
- user and team activity

## Multi-Tenant Requirements

The application should be designed as multi-tenant from the start.

Recommended tenant structure:

- `tenant`: agency/operator/customer account
- `organization`: optional parent company
- `location` or `community`: specific office, market, or senior facility group
- every business row includes `tenant_id`
- backend and database enforce tenant isolation
- tenant-aware search indexes

Tenant-specific configuration should include:

- pipeline stages
- care categories
- lead sources
- custom fields
- permissions
- integrations
- branding

Tenant isolation must happen in the backend and database, not only through
frontend filtering.

## Multi-User Requirements

Likely roles:

- owner/admin
- manager
- advisor/sales
- intake coordinator
- read-only
- external partner/facility contact later

Required capabilities:

- assigned leads and tasks
- team visibility rules
- activity audit log
- internal comments and notes
- notifications
- handoff between users
- permission checks for viewing, editing, exporting, managing users,
  configuring integrations, and deleting/archiving records

## Integration Requirements

Detailed vendor research is saved in `docs/INTEGRATIONS_RESEARCH.md`.

Likely future integrations:

- email: Gmail, Microsoft 365, Outlook
- calendar: Google Calendar, Outlook Calendar
- SMS and phone: Twilio or similar
- maps and geocoding
- website forms and lead capture
- senior directories and referral feeds
- EHR, EMR, and billing systems
- facility/property management systems
- OCR/business card scanning
- document storage and e-signature
- Zapier, webhooks, and public API

Integration design should support:

- one-way and two-way sync
- source-of-truth rules per integration
- scheduled sync jobs
- webhook/event ingestion
- retry handling
- integration audit logs
- conflict resolution
- per-tenant credentials and configuration

## Architecture Implications

Recommended backend direction:

- TypeScript/Node.js API
- PostgreSQL with PostGIS
- row-level tenant scoping
- background workers for data collection, contact refresh, OCR, and sync jobs
- S3 for documents, images, raw source snapshots, and parser evidence
- AWS EventBridge plus ECS/Fargate or Lambda workers
- API-first design so desktop, tablet, and mobile views use the same backend

Core tables/services likely needed:

- `tenants`
- `users`
- `roles`
- `permissions`
- `people`
- `person_relationships`
- `leads`
- `lead_people`
- `facilities`
- `lead_facilities`
- `communications`
- `tasks`
- `appointments`
- `documents`
- `facility_contacts`
- `referral_sources`
- `integrations`
- `integration_events`
- `audit_log`

## Build Priority

1. People directory and relationship graph
2. Lead/person/facility linking
3. Communication and task history
4. Multi-tenant schema and auth model
5. Facility matching and search
6. Integration framework
7. Email, SMS, and calendar integrations
8. Reporting dashboards
9. EHR, property, and referral integrations

## Reference Products Reviewed

- SeniorPlace documentation review: `docs/SENIORPLACE_DOCS_REVIEW.md`
- WelcomeHome CRM
- Aline / Enquire
- Eldermark CRM
- MatrixCare CRM
- PointClickCare CRM
- Yardi Senior CRM

Useful source links:

- https://www.welcomehomesoftware.com/senior-living-crm
- https://www.welcomehomesoftware.com/integrations
- https://welcomehomesoftware.zendesk.com/hc/en-us/articles/25900955352724-EMR-Overview
- https://alineops.com/senior-living/sales-software/
- https://www.eldermark.com/products/senior-living-crm
- https://www.matrixcare.com/customer-relationship-management/
- https://pointclickcare.com/products/crm-customer-relationship-management/
- https://www.yardi.com/product/senior-crm/
