# Setup

## Project Structure

Recommended project structure:

```text
clinical-trial-matching-poc/
  flutter_frontend/
  backend_copy/
  project-context/
    PROJECT_BRIEF.md
    ARCHITECTURE.md
    API_CONTRACT.md
    TASKS.md
    BACKEND_CHANGES.md
    CHANGELOG.md
    DECISIONS.md
    SETUP.md
```

## Requirements

Install the following tools:

- Git
- Flutter SDK
- Node.js
- npm or yarn
- A code editor such as VS Code

## Local Development Setup

Use the local copied backend in `backend_copy/` as the primary development backend.

For safe local development, use the synthetic database kit in:

```text
backend_copy/local-dev/
```

Create the local MySQL database and sample data:

```bash
mysql -u root -p < backend_copy/local-dev/schema.sql
mysql -u root -p < backend_copy/local-dev/seed.sql
```

For an existing local database created before Pharmaceutical Office login support, apply the idempotent compatibility patch instead of rebuilding the database:

```bash
mysql -u root -p < backend_copy/local-dev/pharma-login-compatibility.sql
```

The local demo Pharmaceutical Office login is:

```text
Email: pharm1@test.com
Password: pharm1
Type: Pharma
```

Optional local demo reset for trial `0021`:

```bash
mysql -u root -p < backend_copy/local-dev/trial-0021-demo-patients.sql
```

This replaces local synthetic patients with 20 trial-0021-focused demo patients and clears saved ranked match results. It does not change database schema.

The optional demo reset data is useful for local matching experiments, but the user-facing `Rank 5 Patients (Demo)` control has been removed. Use the dashboard's `Match Patients` menu and choose `Match Next 10 Patients` or `Match All Patients`; both skip patients that already have saved current ranked results for the trial.

Before running the backend, create the required private runtime config files:

- `backend_copy/app/config/db.config.js`
- `backend_copy/app/config/mongodb.config.js`
- `backend_copy/.env`

You can start from the safe examples:

```bash
mkdir -p backend_copy/app/config
cp backend_copy/local-dev/db.config.example.js backend_copy/app/config/db.config.js
cp backend_copy/local-dev/mongodb.config.example.js backend_copy/app/config/mongodb.config.js
```

Edit `backend_copy/app/config/db.config.js` and set your local MySQL password.

The `backend_copy/app/config/` directory is intentionally ignored by Git because these files may contain database credentials or secrets. Do not commit or push them.

Create `backend_copy/.env` locally for server-side environment variables:

```bash
cd backend_copy
cat > .env <<'EOF'
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini
OPENAI_EXTRACTION_SEED=424242
EOF
```

`backend_copy/.env` is intentionally ignored by Git and must not be committed. It may contain private API keys and other secrets. The Clinical Trial Document Field Extractor uses `OPENAI_API_KEY` only on the backend through `process.env.OPENAI_API_KEY`; do not put OpenAI keys in Flutter, web builds, or other client-side code. `OPENAI_EXTRACTION_SEED` is optional and defaults to `424242`; the backend sends it only for allow-listed model names that are expected to support deterministic seed parameters.

After the config files exist, run the backend:

```bash
cd clinical-trial-matching-poc
cd backend_copy
npm install
npm run validate:document-upload
npm run validate:extraction-consistency
npm run validate:matching-modes
npm run validate:trial-edit
npm run dev
```

Then run Flutter:

```bash
cd ../flutter_frontend
flutter pub get
flutter run -d chrome --web-hostname localhost --web-port 3000 --dart-define=API_BASE_URL=http://localhost:8080
```

Sign in with the Pharmaceutical Office credential above. The Flutter app now derives company ID/name from the authenticated Pharma company row rather than from `PHARMA_COMPANY_ID` or `PHARMA_COMPANY_NAME` dart-defines.

The hosted backend `https://tysnx3mi2s.us-east-1.awsapprunner.com` may be used as a temporary testing fallback, but local development should target `backend_copy/`.

## Running Against the TA-Provided Shared Database

As of 2026-07-28 the POC also runs end-to-end against the TA-provided AWS RDS MySQL database. This is a shared, internet-reachable database used by multiple students. Treat every write as real and not easily undone, and confirm before running anything write-heavy.

### Connection credentials

**Host, user, password, and database name are deliberately not recorded in this repository.** They live only in the local, gitignored `backend_copy/app/config/db.config.js`. This repository has a public remote, and a shared database credential must never be committed. Request the values from the TA.

To switch environments, swap `backend_copy/app/config/db.config.js` between your local MySQL settings and the shared ones. Keep a copy of each; nothing else in the codebase needs to change.

Note that the shared database may be rotated or retired between terms. The local synthetic path is self-contained and remains the reliable way to run this project.

### Application login

Use the Pharmaceutical Office credential supplied by your TA for the shared database. The local synthetic login documented earlier in this file (`pharm1@test.com`) is created by `seed.sql` and applies to your local database.

The inherited e-Hospital login branch compares `pharmaceutical_company.password` in **plaintext**. This POC reused that branch rather than redesigning authentication; it is a limitation of the inherited code and not a pattern to carry forward.

### Verifying the shared database schema

`backend_copy/local-dev/prd01-schema-check.sql` is a read-only `INFORMATION_SCHEMA` script that compares the shared database against the tables and columns this POC queries. It creates, changes, and deletes nothing, so it is safe to run against a production-flagged host. Run it after any reported database change rather than trusting a secondhand claim that something was fixed — that mistake cost real time on this project.

It can be run through MySQL Workbench against the shared connection, or from the `mysql` CLI.

### Known differences from the local synthetic database

1. **Table-name case sensitivity.** `PRD01` runs on Linux/RDS with `lower_case_table_names=0`, making table names case-sensitive; local Windows MySQL uses `1` and is case-insensitive. All clinical-trial action/patient table references are therefore lowercase everywhere. Do not reintroduce mixed casing — see `DECISIONS.md` (2026-07-28).
2. **`patients_pathology` has no `medical_history` or `other_notes` columns.** The semantic comparison service reads them defensively, so their absence degrades match quality without raising an error. In practice most supplemental lab/threshold criteria come back as `Missing`, which pushes results toward `Needs Review` regardless of how well a patient otherwise fits. `PRD01` does have dedicated `medical_history`, `family_history`, `surgical_history`, and `allergy_records` tables, but all four are empty.
3. **Scale.** `PRD01` has roughly 201 tables versus 16 in the synthetic schema. Only the subset this POC queries has been verified.

Because of difference 2, demonstrate the ranked patient dashboard against the local synthetic database, where the seed data produces a genuine spread of Strong / Likely / Needs Review / Not Eligible results. Use `PRD01` to show that the integration itself works.

## Environment Variables

Do not commit real `.env` files.

Use this pattern:

```text
.env.example  committed
.env          not committed
```

The `.gitignore` should include:

```gitignore
.env
*.local
node_modules/
build/
dist/
```

## Running the Full POC

Expected local development flow:

1. Start `backend_copy/`.
2. Start `flutter_frontend/`.
3. Use the current clinical trial pages.
4. Add future document upload, criteria review, and ranked AI matching dashboard features incrementally.

## Orientation for New Contributors

Before changing code, read these in order:

1. `project-context/PROJECT_BRIEF.md`
2. `project-context/ARCHITECTURE.md`
3. `project-context/API_CONTRACT.md`
4. `project-context/TASKS.md`

If working on backend code, also read `project-context/BACKEND_CHANGES.md`, which records every change made to an inherited file.
