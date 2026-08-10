# Facility Directory Prototype

Responsive web prototype for the facility directory, map search, advisor view,
and CRM workflows.

Run locally:

```bash
npm run dev:facility-app
```

Open:

```text
http://127.0.0.1:3200
```

Primary local data source:

```text
PostgreSQL/PostGIS through /api/facilities/search, /api/crm/state, and /api/advisors/search
```

Fallback facility data source:

```text
data/facilities/combined-facilities-active.json
```

Local checks:

```bash
npm run health
npm run health:db
npm run test:facility-app
```

The prototype is intentionally separate from the Senior Living Kit marketing
site. It is a local proof point for the future CRM/web app experience across
desktop, tablet, and mobile viewports.

Current UI capabilities:

- directory and CRM view tabs
- searchable facility list
- responsive map-style coordinate panel for facilities with latitude/longitude
- zoom in/out controls for the pin layer
- state, care type, capacity, and visibility filters
- priority up/down controls persisted in browser storage
- exclude/restore controls persisted in browser storage
- excluded facilities hidden from the default visible view
- source details and click-to-call/map/source actions in the detail pane
- sample lead pipeline with editable lead status
- lead detail fields for contact info, urgency, budget, care needs, and next step
- communication log for prospect/family and facility interactions
- CRM state loaded from and saved to local Postgres
- browser storage retained only as a local fallback draft
- advisor directory backed by SeniorPlace and CSA Locator records in Postgres
- business card image upload/camera capture flow
- mock server-side OCR/contact extraction endpoint
- apply extracted contact fields to the selected lead after review

The current map panel uses OpenStreetMap tiles and plots known coordinates from
the facility database. A production app should move filtering, pagination, map
window bounds, and tenant preferences fully server-side.

The current business-card scanner is also a prototype. It sends the selected
image to `/api/business-card/ocr` and receives deterministic mock extraction.
Production should store the image, run OCR on the server, and require review
before saving extracted contact fields.
