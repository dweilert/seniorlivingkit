# Senior App Screenshot Review

Last updated: 2026-08-09

Source folder reviewed:

```text
/Users/bob/@senior
```

The folder contains 53 screenshots named `senior_living_4.png` through
`senior_living_56.png`. They show a senior-placement CRM product with client,
community, task, message, report, form, billing, and admin workflows.

## Major Product Areas Visible

### Navigation Shell

The app uses a persistent left navigation with top-level sections for clients,
communities, favorites, tasks, calendar, files, reports, messaging, and admin
settings. The useful takeaway is that our app should keep operational workflows
one click away instead of burying them under a single CRM tab.

### Client Workspace

The client record is the core workspace. Visible tabs include overview/details,
activity, tasks, notes/documents, community search or recommendations, matching,
history, and reporting. This confirms that a lead is not just a pipeline card:
it needs a full longitudinal record.

Needed screens:

- client profile summary
- editable intake/contact detail
- activity timeline
- related people and influencers
- tasks and follow-ups
- files and forms
- community recommendations
- tours and placement status
- communication history

Core data:

- `leads`
- `people`
- `lead_people`
- `person_relationships`
- `lead_status_history`
- `communications`
- `tasks`
- `entity_files`
- `lead_assessments`

### Community Search And Map

Several screenshots show a split list/map community search with filters and pins.
This matches our current directory direction, but the target workflow is more
placement-specific: search results should be addable to a client recommendation
set, not just viewed as directory records.

Needed screens:

- community directory
- split list/map search
- community detail profile
- saved/favorite communities
- client-specific community options
- side-by-side community comparison

Core data:

- `facilities`
- `facility_profiles`
- `facility_contacts`
- `facility_pricing_updates`
- `facility_availability_updates`
- `lead_community_options`
- `community_report_packages`
- `community_report_items`

### Matching And Assessments

Screens show structured questions, weighted sections, match/rank results, and
printable assessment-style forms. Our current relationship graph is useful, but
the placement workflow also needs structured answers that can drive fit scoring.

Needed screens:

- client needs assessment
- care and ADL/IADL assessment
- lifestyle/preference assessment
- budget/payment assessment
- assessment summary and score
- recommended communities ranked by criteria

Core data:

- `assessment_templates`
- `assessment_template_sections`
- `assessment_questions`
- `lead_assessments`
- `assessment_answers`
- `lead_community_options.match_score`

### Reports And Printable Forms

The screenshots include report lists, comparison reports, and printable PDF-like
forms such as community information, finances, activities, services, and client
profiles. These should be treated as generated artifacts with source data and
versioned templates.

Community Comparison is the most important report workflow because it turns a
filtered set of facilities into a family-facing recommendation package.

Needed screens:

- report list
- custom report builder
- community comparison package
- printable client profile
- printable community profile
- shared/sent report history

Core data:

- `report_definitions`
- `form_templates`
- `form_submissions`
- `community_report_packages`
- `community_report_items`
- `entity_files`

### Tasks, Calendar, And Workflows

Tasks and calendar are separate operational views. The screenshots imply task
assignment, due dates, calendar date navigation, and workflow-driven reminders.

Needed screens:

- task list
- task detail/create
- calendar week/month view
- workflow automation settings
- task templates/types

Core data:

- `tasks`
- `task_types`
- `calendar_events`
- `workflow_definitions`
- `workflow_runs`

### Messaging And Communication

Screens show a messaging inbox and lead-specific email/text activity. A durable
product needs both timeline entries and conversation threads.

Needed screens:

- message inbox
- thread detail
- client communication timeline
- email/text template composer
- communication preferences

Core data:

- `communication_threads`
- `communications`
- `email_templates`
- `people.communication_preferences`
- `integrations`
- `integration_events`

### Files And Uploads

Screens show file lists/uploads on both client and community surfaces. This needs
generic entity attachments rather than a lead-only document table.

Needed screens:

- global files list
- client files
- community files
- upload/review extracted data
- generated report archive

Core data:

- `entity_files`
- `form_submissions`
- `business_card_scans` or future OCR extraction tables

### Admin, Settings, Integrations, And Billing

Screens show organization settings, users, integrations, referral settings,
email management, invoices/payments, and signature tooling. Much of this is
already represented in the schema, but it needs explicit screens.

Needed screens:

- users and roles
- organization settings
- referral source management
- integrations
- email templates
- custom reports
- invoices and payments
- signature templates/requests

Core data:

- `tenants`
- `app_users`
- `tenant_users`
- `referral_sources`
- `integrations`
- `email_templates`
- `report_definitions`
- `invoices`
- `payments`
- `signature_templates`
- `signature_requests`

## Screen Priority For Our Prototype

The next prototype screens should be built in this order:

1. Client workspace with profile, people, activity, tasks, files, and community
   options tabs.
2. Community search/detail with add-to-client option flow.
3. Assessment builder/runtime with structured answers and match criteria.
4. Community comparison report package.
5. Task/calendar workspace.
6. Message inbox/thread view.
7. Admin/settings screens for users, templates, integrations, and reports.

## Design Notes

- The reference app is functionally broad but visually sparse. We should keep
  the information density, but improve hierarchy, spacing, table affordances,
  and mobile behavior.
- Avoid making this a generic CRM. The central workflow is client needs ->
  community match -> tours/application -> placement -> billing/referral followup.
- Maps and community lists should support bulk actions: favorite, exclude,
  compare, add to report, request availability, and log outreach.
- Assessment answers should be structured enough to support future scoring and
  AI-assisted recommendations, not just notes.
