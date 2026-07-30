# Clinical Trial Flutter Frontend

Standalone Flutter frontend for the clinical trial matching POC.

This app replaces the default Flutter counter starter app with clinical trial pages. It should be run against the local copied backend in `../backend_copy/` for normal development, because future agentic AI features will require backend, API, and database changes.

The create-trial form uses editable autocomplete text fields for Pathology, Related Conditions, Diseases, Surgeries, and Medication Exclusions. These fields still submit the same string values expected by the backend deterministic matching logic, but users and uploaded trial documents are no longer limited to short fixed dropdown lists. Multi-value clinical fields show helper text telling users to separate values with commas, and uploaded documents preserve multiple extracted values in the same comma-separated format.

For uploaded multi-location trials, the Region/State field can contain multiple comma-separated regions while Country remains the final country value. Medication Exclusions is optional and should contain only medications that would disqualify a patient.

The authenticated sidebar account area shows only the logged-in Pharmaceutical Office email above Logout. The Clinical Trial List defaults to 10 rows per page, offers 10/20/50 page sizes, places Status after Phase, left-aligns Trial IDs, and opens trial detail pages from any body row cell.

After document extraction, the supplemental criteria panel supports adding a missing criterion or editing one criterion while preserving all other extracted/manual criteria. Uploaded-document trials keep `source_type = supplemental_agent`; user changes are saved as item-level metadata without another AI extraction call.

## Run Locally

Start the backend first:

```bash
cd ../backend_copy
npm install
npm run dev
```

Then start Flutter:

```bash
cd ../flutter_frontend
flutter pub get
flutter run -d chrome --web-hostname localhost --web-port 3000 --dart-define=API_BASE_URL=http://localhost:8080
```

## API Configuration

Set the backend URL with `--dart-define=API_BASE_URL=...`.

Company context comes from the Pharmaceutical Office login session, not `PHARMA_COMPANY_ID` or `PHARMA_COMPANY_NAME` dart-defines.

The hosted backend `https://tysnx3mi2s.us-east-1.awsapprunner.com` may be used as a temporary testing fallback, but it is not the main development workflow.

## Remaining POC Work

Future POC work should continue improving criteria review and ranked matching rerun/staleness behavior.
