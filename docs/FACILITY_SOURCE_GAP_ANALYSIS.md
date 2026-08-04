# Facility Source Gap Analysis

Current active local export:

- 35,680 active records
- 14,693 skilled nursing records from CMS Provider Information
- 11,012 age 55+ elderly-housing records from HUD Section 202
- 9,975 assisted-living / RCFE records from California and Texas

Current all-record local export:

- 40,240 records
- 4,560 inactive California RCFE records are retained for audit and admin review

## Why This Is Still Short Of About 45,000

The 45,000 estimate is plausible if we combine roughly national residential
care communities plus skilled nursing. CDC FastStats reports 32,200 residential
care communities in 2022, and CMS currently reports 14,693 active nursing-home
provider records in the Provider Data API. That rough market frame is about
46,900, before de-duplication between campuses and care levels.

The local collector has national skilled nursing, but it does not yet have
state-by-state assisted living / residential care licensing sources beyond
California and Texas. That is the largest remaining core gap.

## Core Gaps

- Assisted living / residential care in 48 states plus DC and territories.
- Memory-care-specific labels or endorsements where states publish them.
- Private-pay independent living communities that are not licensed care and not
  HUD elderly housing.
- Market-rate 55+ active adult communities; these are usually not government
  licensed as care facilities.

## Added In This Pass

Source ID: `hud-section-202-properties`

- Official HUD/data.gov source
- 11,012 records
- Normalized as `age_55_plus`
- Includes address, phone, total units, assisted units, HUD program/category,
  management organization/contact, manager phone/email, and geocoded coordinates
- This is elderly-serving subsidized multifamily housing, not licensed assisted
  living or independent living

Texas HHSC was also refreshed from the original 300 Austin-area records to all
2,013 statewide assisted-living records.

## Adjacent Official CMS Datasets Found

These can help CRM context, but they should not be included in the default
facility search unless we add an adjacent-care scope filter.

- Home Health Care Agencies: CMS dataset `6jpm-sxkc`, 12,460 records
- Hospice General Information: CMS dataset `yc9t-dgbk`, 6,852 records
- Inpatient Rehabilitation Facility General Information: CMS dataset
  `7t8x-u3ir`, 1,222 records
- Long-Term Care Hospital General Information: CMS dataset `azum-44iv`, 311
  records

Adding all four adjacent CMS sources would add about 20,845 records, but most
are services or hospital-like settings rather than senior living sites.

## Recommended Next Collection Order

1. State assisted living / residential care licensing sources for the largest
   missing states: Florida, New York, Pennsylvania, Ohio, Illinois, Michigan,
   North Carolina, Georgia, Arizona, Washington, Colorado, and New Jersey.
2. State fields that identify memory care, Alzheimer units, dementia care,
   special care units, or secure units.
3. HUD and other affordable senior housing sources as `age_55_plus`.
4. A reviewed website-discovery pipeline for private independent living and
   market-rate 55+ communities.
5. Adjacent CMS home health/hospice/IRF/LTCH sources behind a non-default
   adjacent-care filter.
