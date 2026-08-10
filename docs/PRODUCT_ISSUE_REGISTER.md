# Product Issue Register

Last updated: 2026-08-09

This register turns the list-heavy reference screenshots in `/Users/bob/@senior`
into discrete issues we should evaluate, design, and implement. These are not
GitHub issues yet; they are the curated product backlog that can be promoted to
GitHub/Jira later.

## Priority Legend

- `P0`: Needed before any serious pilot.
- `P1`: Needed for a useful operating workflow.
- `P2`: Important, but can follow the first usable CRM slice.

## Issues

| ID | Priority | Area | Issue | Acceptance Criteria |
| --- | --- | --- | --- | --- |
| CRM-001 | P0 | Client Workspace | Replace the generic CRM tab with a client workspace shell. | User can select a client and see tabs for overview, people, assessment, communities, activity, tasks, and files. |
| CRM-002 | P0 | Client Workspace | Build a client overview panel with intake summary and current pipeline state. | Overview shows resident, primary contact, urgency, budget, care needs, preferred area, assigned owner, next step, and current stage. |
| CRM-003 | P0 | Client Workspace | Move people and relationship graph into the client workspace. | People tab shows linked resident/family/friends/doctors/advisors/facility contacts and preserves relationship graph behavior. |
| CRM-004 | P1 | Client Workspace | Add client activity timeline. | Activity tab combines notes, calls, emails, texts, tasks, tours, files, and status changes in reverse chronological order. |
| CRM-005 | P1 | Client Workspace | Add client file list and upload placeholder. | Files tab lists files attached to client/person/facility/report entities and captures upload metadata. |
| CRM-006 | P1 | Client Workspace | Add client status history. | Every lead status change writes history with from/to/status/time/user/reason. |
| COM-001 | P0 | Communities | Add client-specific community options workflow. | User can add a facility to a client, set option status, priority, excluded reason, notes, referred date, toured date, and selected/declined state. |
| COM-002 | P0 | Communities | Add community option status board/list. | Client communities can be viewed by option status: potential match, referred, toured, selected, declined, excluded. |
| COM-003 | P1 | Communities | Add community detail profile fields beyond public source data. | Detail screen supports care levels, amenities, services, room types, payment types, admission requirements, photos, and review confidence. |
| COM-004 | P1 | Communities | Add latest pricing and availability panels. | Community detail shows most recent pricing and availability by care category with source/evidence fields. |
| COM-005 | P1 | Communities | Add bulk actions from community search. | Search list supports add to client, favorite/priority, exclude, compare, request availability, and log outreach. |
| COM-006 | P2 | Communities | Add saved/favorite community list. | User can view a saved list independent of the current search filters. |
| ASM-001 | P0 | Assessments | Create assessment template model and seed sample senior-placement assessment. | Sample template includes care needs, ADLs/IADLs, memory support, mobility, budget, location, lifestyle, and deal-breakers. |
| ASM-002 | P0 | Assessments | Build client assessment entry screen. | User can answer structured questions, save draft, complete assessment, and see completion status. |
| ASM-003 | P1 | Assessments | Compute fit signals from assessment answers. | Assessment answers can produce scores or tags used by community match/recommendation logic. |
| ASM-004 | P1 | Assessments | Show assessment summary on client overview. | Overview displays top care needs, budget range, location constraints, and recommended next action. |
| RPT-001 | P0 | Reports | Build community comparison report package data flow. | User can choose client communities and generate a draft comparison package with ordered items, strengths, concerns, fit score, and notes. |
| RPT-002 | P1 | Reports | Add printable/shareable report shell. | Report package can render a family-facing view suitable for PDF/export later. |
| RPT-003 | P2 | Reports | Add custom report definitions UI. | User can define columns, filters, grouping, and saved report ownership. |
| TSK-001 | P0 | Tasks | Add task list with filters. | User can filter tasks by due date, assignee, status, type, client, and facility. |
| TSK-002 | P1 | Tasks | Add task create/edit drawer. | User can create/edit task title, type, status, due date, assignee, linked client/person/facility, recurrence, and notes. |
| CAL-001 | P1 | Calendar | Add calendar event model usage in UI. | User can view tours/follow-ups/calls/tasks by week/month and open linked records. |
| CAL-002 | P2 | Calendar | Add external calendar integration planning. | Calendar events include external calendar/event IDs and sync status. |
| MSG-001 | P0 | Messaging | Add communication thread/inbox screen. | User can view threads by client/person/facility/channel/status and open thread detail. |
| MSG-002 | P1 | Messaging | Connect communication timeline to thread records. | New communications can be associated with a thread and still appear in client activity. |
| MSG-003 | P2 | Messaging | Add email/text template composer. | User can choose template, preview placeholders, and log/send message later through an integration. |
| FIL-001 | P1 | Files | Add generic entity file attachment data flow. | Files can be attached to client, person, facility, form submission, report package, or invoice. |
| FIL-002 | P2 | Files | Add OCR/extracted text review state. | Uploaded files can store extracted text, source type, metadata, and review status. |
| FRM-001 | P1 | Forms | Add form template list. | User can manage printable/custom forms and active/inactive status. |
| FRM-002 | P1 | Forms | Add form submission workflow. | User can create form submission for a client/community/person and save structured values. |
| ADM-001 | P0 | Admin | Add users/roles screen plan. | Admin can view users, roles, status, and tenant membership. |
| ADM-002 | P1 | Admin | Add custom fields screen plan. | Admin can define entity-specific fields with type, options, required flag, order, and active flag. |
| ADM-003 | P1 | Admin | Add integrations screen plan. | Admin can view provider, mode, status, config summary, and latest events/errors. |
| REF-001 | P1 | Referrals | Add referral source directory. | User can create and search referral sources by name, type, organization, phone, email, and notes. |
| BIL-001 | P2 | Billing | Add invoices and payments list. | User can view invoice status, due date, facility/client links, amount, payments, and external accounting URL. |
| SIG-001 | P2 | Signatures | Add signature template/request list. | User can manage signature templates, recipients, request status, sent/completed dates, and signed document URI. |
| DAT-001 | P0 | Data | Persist tenant/user facility preferences. | Priority, exclusion, notes, and favorites are stored in Postgres instead of browser storage. |
| DAT-002 | P0 | Data | Move facility search pagination and map bounds server-side. | API supports page, page size, sort, filters, radius, and map bounding box without loading 50k records to the browser. |
| DAT-003 | P1 | Data | Add website discovery job planning. | Data model and collector plan define website search source, confidence, source URL, parser evidence, and refresh cadence. |
| SEC-001 | P0 | Security | Add tenant scoping and auth plan before external access. | Every API route has tenant/user context and rejects unauthenticated access in non-local mode. |

## First Implementation Batch

Start with these issues:

1. `CRM-001`
2. `COM-001`
3. `ASM-001`
4. `ASM-002`
5. `DAT-001`
6. `DAT-002`

This batch converts the current prototype from a broad demo into the core
placement workflow: client workspace, structured assessment, client-specific
community options, and persistent preferences/search.

## Promotion To GitHub Issues

When ready, promote this register to GitHub issues with labels:

- `area:crm`
- `area:communities`
- `area:assessments`
- `area:reports`
- `area:tasks`
- `area:messaging`
- `area:data`
- `priority:p0`
- `priority:p1`
- `priority:p2`

Keep this document as the product-source register even if GitHub issues become
the active engineering tracker.
