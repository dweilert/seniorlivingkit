# Senior Living Facility Seed Data

Generated from public state facility data sources:

https://services1.arcgis.com/jI1j5lArZnrgFYSc/ArcGIS/rest/services/Assisted_Living/FeatureServer/0

https://lab.data.ca.gov/dataset/community-care-licensing-facilities/6b2f5818-f60d-40b5-bc2a-94f995f9f8b0

https://data.cms.gov/provider-data/dataset/4pq5-n9py

https://catalog.data.gov/dataset/section-202-properties-5a638

The Texas dataset contains statewide assisted-living records from Texas HHSC.

The California dataset contains Residential Care Facilities for the Elderly
records exposed by the California CDSS open-data table. California records can
be enriched with U.S. Census geocoding.

The CMS dataset contains national skilled-nursing / nursing-home provider
records.

The HUD dataset contains elderly-serving assisted multifamily housing properties
and is normalized as `age_55_plus`, not assisted living.

Fields include facility name, facility ID, program type, county, address, city,
state, ZIP, phone, fax, capacity, status fields where available, active flag,
coordinates where available, source metadata, and computed distance from the
configured center point where possible.

Files:

- `texas-assisted-living-all.csv`
- `texas-assisted-living-all.json`
- `california-rcfe-all.csv`
- `california-rcfe-all.json`
- `cms-nursing-home-provider-info-all.csv`
- `cms-nursing-home-provider-info-all.json`
- `hud-section-202-properties-all.csv`
- `hud-section-202-properties-all.json`
- `combined-facilities-all.csv`
- `combined-facilities-all.json`
- `combined-facilities-active.csv`
- `combined-facilities-active.json`
- `combined-facilities-manifest.json`
- `tx-hhsc-assisted-living-latest-manifest.json`
- `ca-cdss-rcfe-latest-manifest.json`
- `cms-nursing-home-provider-info-latest-manifest.json`
- `hud-section-202-properties-latest-manifest.json`
- `runs/tx-hhsc-assisted-living/<run-id>/manifest.json`
- `runs/tx-hhsc-assisted-living/<run-id>/raw-source.json`
- `runs/tx-hhsc-assisted-living/<run-id>/normalized-records.json`
- `runs/tx-hhsc-assisted-living/<run-id>/normalized-records.csv`

Notes:

- This is public licensing/map data, not a verified marketing database.
- Source fields may contain stale, incomplete, or inconsistent values.
- Facility status, pricing, availability, amenities, and referral contacts should
  be verified before using this for placement decisions.
