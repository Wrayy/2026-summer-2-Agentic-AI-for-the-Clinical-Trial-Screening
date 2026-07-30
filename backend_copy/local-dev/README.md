# Local Development Database

This folder contains a shareable local MySQL setup for the Clinical Trial Matching POC.

It is intentionally limited to the tables used by the current clinical trial Flutter flow and copied backend routes. It is not a full e-Hospital production schema.

## What Is Included

- `schema.sql` creates a local `clinical_trial_matching_poc` database.
- `seed.sql` inserts 20 synthetic patients, doctors, clinical trials, pathology data, and trial actions.
- `pharma-login-compatibility.sql` updates existing local databases so the original copied-backend Pharma login branch can authenticate the standalone Flutter app.
- `trial-0021-demo-patients.sql` is an optional destructive demo reset that replaces local patients with 20 synthetic patients tailored to trial `0021`.
- `db.config.example.js` is a safe example for local MySQL.
- `mongodb.config.example.js` disables MongoDB for local clinical trial POC development.

All data is fake and safe to commit.

The seed data includes one preloaded NCT-inspired local test trial for the agentic matching workflow:

- `NCT06660173` style type 2 diabetes / obesity metabolic disease trial.

The hypertension (`NCT05769608`) and rheumatoid arthritis (`NCT06671054`) practice trials are intentionally not preloaded, so they can be used as clean end-to-end tests for document extraction, trial creation, and matching.

Because the copied backend stores `clinical_trials.trial_id` as an integer, these are stored using the numeric NCT portion as the local `trial_id` and keep the full NCT identifier in the trial name/title.

The synthetic patients use the existing copied-backend table shape:

- `patients_registration` for demographics and stable identity fields.
- `patients_pathology` for deterministic matching fields plus semantic context in `medical_history` and `other_notes`.

Patient profile BMI is calculated by the Flutter UI from structured height/weight fields. Seeded `other_notes` should stay patient-only clinical context and should not contain trial verdicts, intended match/non-match labels, or duplicate BMI summaries.

No additional patient-context table is created in the local schema.

The local schema also includes two POC-only agent workflow tables:

- `clinical_trial_semantic_criteria` stores supplemental, medically relevant trial criteria extracted from trial documents separately from hard exclusion criteria.
- `clinical_trial_match_results` stores one generated match result per trial-patient pair, including deterministic output, semantic comparison output, score, status, explanation, suggested actions, and hashes for incremental reruns.

The local schema also includes `clinical_trial_id_sequence`, a single-row counter used only to keep the editable four-digit TrialID autofill moving forward after trials are deleted. It is intentionally smaller than storing full TrialID history.

`seed.sql` populates `clinical_trial_semantic_criteria` for the preloaded diabetes practice trial. `clinical_trial_match_results` intentionally starts empty because it should be written by the matching/scoring pipeline, not hand-authored as source data.

`seed.sql` also configures the local Pharmaceutical Office demo login:

```text
Email: pharm1@test.com
Password: pharm1
Type: Pharma
```

For an existing local database created before this login fixture was added, run:

```bash
mysql -u root -p < backend_copy/local-dev/pharma-login-compatibility.sql
```

## Optional Trial 0021 Demo Patients

If trial `0021` exists in your local database and you want a hypertension-focused demo cohort, run:

```bash
mysql -u root -p < backend_copy/local-dev/trial-0021-demo-patients.sql
```

This script deletes local patient rows, patient-pathology rows, patient-doctor links, trial-patient links, and saved ranked match results, then inserts 20 synthetic patients designed to produce a wide range of matches and non-matches for the Lorundrostat uncontrolled-hypertension trial. The patient profile notes remain patient-only clinical context; the matching variety comes from structured demographics, height/weight, diagnoses, medications, surgeries, labs, and clinical notes. It does not change schema.

## What Is Not Included

Do not commit:

- `backend_copy/app/config/db.config.js`
- `backend_copy/app/config/mongodb.config.js`
- real database credentials
- real MongoDB connection strings
- real patient, doctor, company, or trial data

## Setup

Install MySQL locally, then run these commands from the repository root:

```bash
mysql -u root -p < backend_copy/local-dev/schema.sql
mysql -u root -p < backend_copy/local-dev/seed.sql
```

Create the private config folder:

```bash
mkdir -p backend_copy/app/config
```

Copy the example config files:

```bash
cp backend_copy/local-dev/db.config.example.js backend_copy/app/config/db.config.js
cp backend_copy/local-dev/mongodb.config.example.js backend_copy/app/config/mongodb.config.js
```

Edit `backend_copy/app/config/db.config.js` and set your local MySQL password.

Leave `mongodb.config.js` disabled unless you are intentionally working on copied backend routes that require MongoDB imaging data.

Then run the backend:

```bash
cd backend_copy
npm install
npm run validate:document-upload
npm run validate:extraction-consistency
npm run validate:trial-edit
npm run dev
```

In a second terminal, run the Flutter frontend against the local backend:

```bash
cd flutter_frontend
flutter pub get
flutter run -d chrome --web-hostname localhost --web-port 3000 --dart-define=API_BASE_URL=http://localhost:8080
```

Sign in with the local Pharmaceutical Office credential above. Company context is loaded from the authenticated Pharma company row.

## Notes

All clinical-trial action/patient table names are now lowercase everywhere: `clinicaltrials_actions`, `clinicaltrials_actionrequests`, `clinicaltrials_actionresponses`, and `clinicaltrials_patients`.

This matters. The copied backend originally used mixed casing (`ClinicalTrials_Actions` in code, lowercase elsewhere). On a normal Windows MySQL install that is harmless because `lower_case_table_names=1` makes table names case-insensitive. On Linux — including AWS RDS, where the production `PRD01` database runs — the default is `lower_case_table_names=0`, so table names are **case-sensitive** and the mixed-case queries fail with `ER_NO_SUCH_TABLE` against tables that plainly exist.

That is exactly what broke trial creation, trial deletion, and supplemental-criteria saving against `PRD01` on 2026-07-28. Keep these names lowercase in both code and schema; do not reintroduce the mixed casing. See `project-context/DECISIONS.md` for the full write-up.
