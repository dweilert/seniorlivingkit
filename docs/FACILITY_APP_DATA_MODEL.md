# Facility App Data Model

The responsive web app should not read raw source snapshots directly. The
collector should load normalized records into database tables, and the app should
read from API endpoints or database views.

See `docs/SENIOR_LIVING_CRM_REQUIREMENTS.md` for the broader CRM product
requirements, including multi-tenant, multi-user, relationship graph, and
integration direction.

See `docs/SENIORPLACE_DOCS_REVIEW.md` for the saved competitive/workflow review
that drove the placement workflow schema additions.

See `docs/SENIOR_APP_SCREEN_REVIEW.md` and `docs/SCREEN_AND_DATA_BACKLOG.md`
for the screenshot-driven screen inventory and the migration 005 model additions.

## Core Tables

`facility_sources`

- `source_id` primary key
- `name`
- `jurisdiction`
- `source_owner`
- `source_system`
- `source_url`
- `active_statuses`

`facility_source_runs`

- `run_id` primary key
- `source_id`
- `generated_at`
- `selected_records`
- `active_records`
- `inactive_records`
- `selected_records_sha256`
- `validation`
- `raw_snapshot_s3_uri`
- `normalized_snapshot_s3_uri`

`facilities`

- `facility_key` primary key
- `facility_name`
- `care_category`: one of `age_55_plus`, `independent_living`, `assisted_living`, `memory_care`, `skilled_nursing`
- `program_type`
- `address`
- `city`
- `county`
- `state`
- `zip`
- `phone`
- `fax`
- `capacity`
- `licensee`
- `administrator`
- `facility_status`
- `is_active`
- `latitude`
- `longitude`
- `source_id`
- `source_facility_id`
- `source_url`
- `last_seen_run_id`
- `first_seen_at`
- `last_seen_at`

`facility_user_preferences`

- `user_id`
- `facility_key`
- `priority`
- `is_excluded`
- `notes`
- `updated_at`

`facility_web_profiles`

- `facility_key`
- `website_url`
- `website_source`
- `website_source_url`
- `discovered_at`
- `verified_at`
- `confidence`
- `review_status`

`facility_contact_enrichment_runs`

- `run_id` primary key
- `facility_key`
- `website_url`
- `final_url`
- `checked_at`
- `parser_version`
- `http_status`
- `fetched_pages`
- `emails`
- `phones`
- `contact_links`
- `evidence`
- `parser_rules`
- `parsing_notes`
- `raw_snapshot_s3_uri`

`leads`

- `lead_id` primary key
- `name`
- `relationship`
- `phone`
- `email`
- `status`
- `urgency`
- `budget`
- `care_needs`
- `preferred_area`
- `assigned_to`
- `next_step`
- `created_at`
- `updated_at`

`lead_facilities`

- `lead_id`
- `facility_key`
- `priority`
- `is_excluded`
- `fit_notes`
- `tour_status`
- `availability_status`
- `updated_at`

`lead_statuses`

- `tenant_id`
- `name`
- `stage_order`
- `color`
- `is_active`
- `is_closed`

`lead_status_history`

- `lead_id`
- `from_status`
- `to_status`
- `changed_by_user_id`
- `change_reason`
- `changed_at`

`lead_community_options`

- `lead_id`
- `facility_key`
- `option_status`: potential match, referred, toured, selected, declined, etc.
- `match_score`
- `is_excluded`
- `exclusion_reason`
- `referred_at`
- `selected_at`
- `declined_at`
- `notes`

This table is the placement-specific version of `lead_facilities`. The
prototype can continue using `lead_facilities` briefly, but the durable product
model should use `lead_community_options` for match/comparison/tour/selection
workflow.

`facility_pricing_updates`

- `facility_key`
- `care_category`
- `min_monthly_cost`
- `max_monthly_cost`
- `currency`
- `effective_date`
- `source_type`
- `source_url`
- `source_note`
- `parser_version`
- `evidence`
- `checked_at`

`facility_availability_updates`

- `facility_key`
- `vacancy_status`
- `available_beds`
- `care_category`
- `notes`
- `source_type`
- `source_url`
- `source_note`
- `parser_version`
- `evidence`
- `checked_at`

`tours`

- `lead_id`
- `facility_key`
- `scheduled_at`
- `completed_at`
- `status`
- `attendee_notes`
- `feedback`
- `next_step`
- `created_by_user_id`

`communications`

- `communication_id` primary key
- `lead_id`
- `facility_key`
- `direction`
- `channel`
- `subject`
- `body`
- `occurred_at`
- `created_by`

`communication_threads`

- `tenant_id`
- `lead_id`
- `person_id`
- `facility_key`
- `subject`
- `channel`
- `status`
- `last_activity_at`

`assessment_templates`

- `tenant_id`
- `name`
- `assessment_type`
- `version`
- `is_active`

`assessment_template_sections`

- `assessment_template_id`
- `section_key`
- `title`
- `display_order`

`assessment_questions`

- `assessment_template_section_id`
- `question_key`
- `label`
- `response_type`
- `options`
- `scoring`
- `is_required`

`lead_assessments`

- `tenant_id`
- `lead_id`
- `assessment_template_id`
- `status`
- `score`
- `summary`
- `completed_at`

`assessment_answers`

- `lead_assessment_id`
- `question_key`
- `value`
- `notes`

`form_templates`

- `tenant_id`
- `name`
- `form_type`
- `schema`
- `is_printable`

`form_submissions`

- `form_template_id`
- `lead_id`
- `facility_key`
- `person_id`
- `status`
- `submitted_values`
- `submitted_at`

`entity_files`

- `tenant_id`
- `entity_type`
- `entity_id`
- `file_name`
- `content_type`
- `byte_size`
- `storage_uri`
- `source_type`
- `extracted_text`
- `metadata`

`facility_profiles`

- `facility_key`
- `profile_status`
- `care_levels`
- `amenities`
- `services`
- `room_types`
- `accepted_payment_types`
- `admission_requirements`
- `photos`
- `profile_source`
- `confidence`

`community_report_packages`

- `tenant_id`
- `lead_id`
- `name`
- `report_type`
- `status`
- `cover_note`
- `generated_uri`
- `sent_at`

`community_report_items`

- `report_package_id`
- `facility_key`
- `display_order`
- `recommendation_label`
- `strengths`
- `concerns`
- `fit_score`
- `notes`

`calendar_events`

- `tenant_id`
- `title`
- `event_type`
- `lead_id`
- `person_id`
- `facility_key`
- `task_id`
- `tour_id`
- `starts_at`
- `ends_at`
- `status`

`business_card_scans`

- `scan_id` primary key
- `lead_id`
- `facility_key`
- `uploaded_by`
- `image_s3_uri`
- `ocr_provider`
- `ocr_confidence`
- `extracted_contact`
- `review_status`
- `created_at`
- `reviewed_at`

`custom_fields`

- `tenant_id`
- `entity_type`
- `field_key`
- `label`
- `field_type`
- `options`
- `is_required`
- `display_order`
- `is_active`

`custom_field_values`

- `custom_field_id`
- `entity_type`
- `entity_id`
- `value`

`email_templates`

- `tenant_id`
- `name`
- `template_type`
- `subject`
- `body`
- `placeholders`
- `attachments`
- `is_shared`

`report_definitions`

- `tenant_id`
- `name`
- `record_type`
- `columns`
- `conditions`
- `grouping`
- `schedule`
- `is_shared`

`workflow_definitions`

- `tenant_id`
- `name`
- `trigger_type`
- `trigger_config`
- `actions`
- `is_active`

`workflow_runs`

- `workflow_id`
- `entity_type`
- `entity_id`
- `status`
- `result`
- `error`
- `started_at`
- `finished_at`

`invoices`, `invoice_items`, and `payments`

- invoice status, number, dates, external invoice link, line items, and payment
  history

`signature_templates` and `signature_requests`

- document template metadata, sender/recipient fields, request status,
  recipients, sent/completed timestamps, and signed document URI

PostgreSQL/PostGIS should store coordinates as both numeric latitude/longitude
and a generated geography point for radius search.

## App-Facing Views

`active_facilities_search`

Default web/mobile search surface. Includes only `is_active = true`.

`all_facilities_admin`

Admin/research surface. Includes inactive, closed, pending, and source-anomaly
records.

`facility_source_lineage`

Audit surface joining facilities to source metadata and most recent run metadata.

## Mobile/Tablet Requirements

Mobile and tablet views will need:

- active-only default search
- city/state/ZIP filters
- normalized category, source type, bed-count min/max, and map-pin count filters
- address/radius filters once records have coordinates or can be geocoded
- cost filters only after a reliable pricing source or manually maintained cost range is available
- click-to-call phone links
- map/radius search where coordinates exist
- scrollable result list synchronized with map pins
- priority controls for preferred facilities
- exclude/restore controls for facilities that should not be shown by default
- clear "location not geocoded" handling where coordinates are missing
- admin-only source provenance display
- facility website profile with open-site and refresh-contact actions
- contact enrichment provenance showing URL, parser version, timestamp, and parsing notes
- lead pipeline with fast status changes
- communication history tied to prospects and facilities
- call/email/text actions that can log an activity back to the lead
- business card image capture/upload from mobile browser
- OCR extraction with human review before saving extracted contacts

California currently needs a geocoding enrichment step before map/radius search
can be complete.

## Business Card Capture

The browser can use a normal file input with `accept="image/*"` and
`capture="environment"` to open the phone camera on supported mobile browsers.
The client should upload the image to the server; OCR should happen server-side.

Recommended production flow:

1. Browser captures/uploads image.
2. API stores the original image in S3.
3. API creates a `business_card_scans` row with `review_status = pending`.
4. OCR service extracts contact fields.
5. Extracted JSON is saved with confidence and provider metadata.
6. User reviews and applies fields to a lead, contact, facility contact, or
   communication record.

Good OCR candidates on AWS are Amazon Textract for text extraction plus a small
contact-field parser, or a multimodal model endpoint if contact extraction needs
more robust layout reasoning.
