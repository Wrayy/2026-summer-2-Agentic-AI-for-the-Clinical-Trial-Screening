# Tasks

## Purpose

This file tracks current and planned implementation tasks for the project.

Work on one task at a time and avoid making unrelated changes.

## Status Summary (2026-07-28)

All planned POC tasks are complete. The six-agent pipeline runs end-to-end against both the local synthetic database and the TA-provided shared database.

Tasks 1-3 (documentation, frontend setup, backend copy) are done; they were left marked "In progress" through most of development because the files they created kept being extended. Task 4 (inspect existing backend logic) was completed in substance — its findings live in `ARCHITECTURE.md` and `BACKEND_CHANGES.md` rather than as a separate deliverable.

### Remaining Work for a Future Team

Ordered by impact. See the README's "Known limitations and next steps" for fuller context.

1. **Patient clinical depth.** The shared database's `patients_pathology` has no `medical_history` or `other_notes` columns, so most supplemental lab/threshold criteria evaluate as `Missing` and nearly every patient lands on `Needs Review`. This is the largest constraint on result quality. Either extend that table (the local schema has both columns, and `semanticComparisonService.js` already reads them) or connect the populated tables holding that clinical narrative.
2. **Keep local synthetic testing in the loop.** Target the local synthetic database for development and use the shared database for integration checks. The 2026-07-28 case-sensitivity bug reproduced only against the shared database and was invisible locally — see `DECISIONS.md`.
3. **Hash-based stale detection** (finish Task 12). `patient_context_hash` and `trial_criteria_hash` exist in the schema but are never populated, so results do not go stale when a patient's record changes.
4. **Unify the two matching implementations** (finish Task 7). `deterministicMatchingService.js` deliberately reimplements the rules from `userController.getSingleClinicalTrialsMatchedPatients` to avoid editing shared code. Both now exist.
5. **Verify remaining flows against the shared database.** The invite/application workflow endpoints, trial editing, trial status changes, and Refresh Saved Results have been exercised locally only.
6. **Carry the patient's actual values into deterministic summaries.** The dashboard shows "Age matches trial criteria" rather than "Age 52 is within the required 18-75 range". The service already returns the detail.
7. **Reintegration into the e-Hospital backend**, if that becomes the goal. `BACKEND_CHANGES.md` lists every inherited-file change with reintegration notes. The 2026-07-28 table-name fix is flagged as an upstream bug worth sending back regardless.

## Completed Sprint

### Task 16: Focused Trial List, Cancel, Matching, and Demo-Control Cleanup

Status: Completed

Completed work:

- Aligned Clinical Trial List status chips with the Status header and sized supported statuses, including Under Review, without ellipsis.
- Added edit-mode Cancel with dirty-change confirmation and back-navigation protection.
- Added extraction Cancel with pre-extraction state restore and late-response rejection by request ID.
- Replaced generic/demo matching controls with Match Next 10 Patients and Match All Patients.
- Moved unmatched-patient selection into the backend so Next 10 is server-enforced and existing current results are skipped.
- Removed user-facing Fill Test Data and Rank 5 Patients (Demo) controls.
- Added focused Flutter tests and `validate:matching-modes`.

### Task 15: Focused UI, Extraction Consistency, and Supplemental Criteria Editing

Status: Completed

Goal:

Improve the authenticated trial workspace UI, reduce irrelevant variability in fresh document extraction, and let reviewers add/edit supplemental criteria without replacing saved structured criteria.

Completed work:

- Simplified the sidebar account area so it shows only the authenticated email above Logout while preserving company identity in auth/API state.
- Updated the Clinical Trial List to default to 10 rows, offer 10/20/50 page sizes, place Status after Phase, left-align Trial IDs, and open trial details from any body row cell.
- Stabilized document preprocessing and extraction diagnostics while preserving the requirement that every upload reruns both extraction agents.
- Added prompt/schema/preprocessing version metadata, deterministic extraction settings, strict JSON Schema response format where supported, and a fixed configurable extraction seed where supported.
- Added focused extraction-consistency validation without requiring OpenAI calls.
- Added structured Add criterion / Edit criterion controls for uploaded, manual, and existing saved semantic criteria in the shared create/edit form.
- Preserved `supplemental_agent` source type for uploaded-document criteria even when individual criteria are user-added or edited.
- Kept semantic criteria edits tied into the existing trial-edit ranked-result invalidation flow.

Done when:

- Sidebar and trial-list UI behavior are covered by Flutter tests. [done]
- Extraction preprocessing and fresh-agent invocation are covered by backend validation. [done]
- Supplemental criteria add/edit behavior is covered by Flutter tests. [done]
- API, backend, architecture, decision, setup, changelog, task, and README documentation are updated. [done]

### Task 14: Implement Pharmaceutical Office Login

Status: Completed

Goal:

Gate the standalone Flutter clinical-trial app behind the original e-Hospital pharmaceutical-company login flow.

Completed work:

- Added a Pharma-only "Pharmaceutical Office Login" screen.
- Preserved the original `POST /api/users/login` request shape with `selectedOption = "Pharma"`.
- Added browser session/local storage based Remember Me behavior through a VM-safe storage abstraction.
- Added app-level auth gating, logout, and stored-session restoration.
- Replaced fixed `PHARMA_COMPANY_ID` / `PHARMA_COMPANY_NAME` runtime company context with the authenticated company identity.
- Preserved create, edit, detail, matching, status, delete, and ranked-dashboard navigation behind the authenticated app shell.
- Updated local development schema/seed compatibility so `pharm1@test.com` / `pharm1` works against the copied backend's original Pharma login branch.

Done when:

- Login succeeds with the documented local Pharma credential. [done]
- Bad credentials show a clear login failure. [done]
- Remember Me controls storage duration. [done]
- Logout clears stored login state. [done]
- Company-scoped trial calls use the authenticated company ID. [done]
- API, architecture, decisions, setup, changelog, and backend-change docs are updated. [done]

### Task 13: Implement Trial Editing With Criteria-Based Ranked Result Invalidation

Status: Completed

Goal:

Allow users to edit an existing clinical trial without changing its Trial ID or recreating related workflow records.

Completed work:

- Added an Edit Trial action on the trial detail page.
- Reused `ClinicalTrialFormScreen` in explicit edit mode with current trial/contact fields prefilled.
- Made Trial ID read-only and immutable in edit mode.
- Preserved create-mode document extraction and review behavior where applicable.
- Preserved trial status through the existing status control rather than resetting it during edits.
- Preserved existing semantic criteria rows when untouched, including structured `supplemental_agent` rows that are not flattened into manual text.
- Added explicit replacement behavior for saved structured semantic criteria.
- Added `POST /api/clinical-trial-poc/update-trial` for transactional updates of `clinical_trials`, `clinical_trials_contacts`, optional `clinical_trial_semantic_criteria`, and criteria-based ranked-result invalidation.
- Added server-side normalized comparison so only eligibility-relevant changes clear saved `clinical_trial_match_results` rows.
- Preserved saved ranked dashboard rows for general/administrative edits.

Done when:

- Trial detail can open edit mode. [done]
- Existing trial fields and saved semantic criteria prefill. [done]
- General edits preserve saved ranked results. [done by implementation]
- Eligibility criteria edits clear saved ranked results atomically. [done by implementation]
- API, backend reintegration notes, architecture, decisions, changelog, and task docs are updated. [done]

### Task 1: Initialize Project Documentation

Status: Completed

Goal:

Create the initial project context files used by the team.

Relevant files:

- `PROJECT_BRIEF.md`
- `ARCHITECTURE.md`
- `API_CONTRACT.md`
- `BACKEND_CHANGES.md`
- `TASKS.md`
- `CHANGELOG.md`
- `DECISIONS.md`
- `SETUP.md`

Done when:

- Initial documentation exists.
- Documentation reflects the agentic clinical trial matching workflow.
- Backend reintegration tracking is included.

### Task 2: Set Up Flutter Frontend

Status: Completed

Goal:

Create the standalone Flutter frontend for the POC.

Completed work:

- Initialize Flutter app.
- Add basic navigation.
- Add existing clinical trial frontend pages to `flutter_frontend/`.

Remaining future POC work:

- Trial document upload/input.
- Extracted trial fields review.
- Supplemental criteria review.
- Ranked AI patient dashboard.
- Patient explanation/details for AI-ranked results.

Done when:

- Flutter app runs locally.
- Existing clinical trial pages are available.
- Project setup instructions are added to `SETUP.md`.

### Task 3: Copy Backend Into Project

Status: Completed

Goal:

Copy the existing e-Hospital backend into the standalone project workspace.

Original backend:

https://github.com/ottawa-ehospital/E-react-node-backend

Expected work:

- Copy backend code into the project.
- Record copy date and source in `BACKEND_CHANGES.md`.
- Confirm backend can run locally or document blockers.
- Document that private `backend_copy/app/config/` files are required locally and must not be committed.
- Add a safe local development database setup so group members do not need to write to a remote database.

Done when:

- Backend copy exists.
- `BACKEND_CHANGES.md` includes source and copy information.
- Setup steps are documented.
- Local schema and synthetic seed data are available for local development.

### Task 4: Inspect Existing Backend Clinical Trial Logic

Status: Completed (findings recorded in ARCHITECTURE.md and BACKEND_CHANGES.md)

Goal:

Identify existing backend files, routes, controllers, services, and database tables related to clinical trials and patient matching.

Expected work:

- Locate clinical trial routes.
- Locate patient profile routes.
- Locate deterministic matching logic.
- Locate relevant database queries.
- Document findings in `ARCHITECTURE.md` or a backend notes section.

Done when:

- Relevant backend files are listed.
- Existing deterministic fields are confirmed.
- Recommended extension points are identified.

### Task 5: Implement Required Field Extraction Endpoint

Status: Completed

Goal:

Create a backend endpoint for the Clinical Trial Document Field Extractor.

Completed work:

- Added `POST /api/clinical-trial-poc/extract-trial-fields`.
- Accept PDF/DOCX/TXT/MD uploads using multipart form data.
- Extract document text server-side.
- Use server-side OpenAI LLM extraction when `OPENAI_API_KEY` is configured.
- Return structured trial fields based on `API_CONTRACT.md`.
- Return missing required fields, review fields, and confidence/source notes.
- Keep changes isolated in new POC route/controller/service files.
- Added Flutter upload and review-only autofill in the create trial form.

Done when:

- Endpoint exists.
- Basic static syntax checks pass.
- `API_CONTRACT.md` and `BACKEND_CHANGES.md` are updated.

### Task 6: Implement Supplemental Criteria Extraction Endpoint

Status: Completed

Goal:

Create a backend endpoint for the Supplemental Criteria Interpretation Agent.

Completed work:

- Added `supplementalCriteriaAgent.js`, run against the same uploaded document as the field extractor inside `/api/clinical-trial-poc/extract-trial-fields` (merged into that response as `supplementalCriteria`), rather than a second standalone endpoint.
- Added `POST /api/clinical-trial-poc/save-semantic-criteria` to persist the preview into `clinical_trial_semantic_criteria` once a trial is created, keyed by `trial_id` (now unique) so saves upsert.
- Added a Flutter review panel showing structured form fields and supplemental criteria separately after upload.

Done when:

- Endpoint exists. [done]
- Basic test request works. [manual OpenAI-backed test still needed with a real API key]
- `API_CONTRACT.md` and `BACKEND_CHANGES.md` are updated. [done]

### Task 7: Implement Deterministic Matching Output

Status: Completed (unification with legacy matching remains open)

Goal:

Adapt or expose existing deterministic matching logic so it returns structured match details.

Completed work:

- Added an isolated `deterministicMatchingService.js` returning structured `matchedFields`/`failedFields`/`missingFields`/`hardExclusionFlags` output per patient.
- Added `POST /api/clinical-trial-poc/deterministic-match` (trial-id based) exposing this service.
- On 2026-07-09, narrowed the POC ranked-matching deterministic layer to objective fields that align cleanly between trial and patient records: gender, age, BMI, and pregnancy. Multi-value/free-text clinical fields such as related conditions, pathology, diseases, surgeries, and medication exclusions are now semantic comparison inputs instead of exact deterministic checks.

Remaining work:

- Wire this structured output into the ranked dashboard / scoring pipeline once those exist (Tasks 9-11).
- Decide whether to eventually unify this with `userController.getSingleClinicalTrialsMatchedPatients` instead of keeping duplicated rule logic.

Done when:

- Deterministic matching endpoint or service returns structured output. [done]
- Output can be used by the scoring and explanation agents. [pending those agents]

### Task 8: Implement Semantic Patient-Trial Comparison

Status: Completed

Goal:

Create the semantic comparison flow for additional trial information and additional patient information.

Completed work:

- Added `semanticComparisonAgent.js`, comparing one patient at a time against a trial's saved semantic criteria and patient clinical context, without producing a score or recommendation.
- Added `semanticComparisonService.js`, which loads the trial's saved `clinical_trial_semantic_criteria` row (errors clearly if none exists), adds the trial form's semantic clinical fields (`related_conditions`, `pathology`, disease exclusions, surgery exclusions, medication exclusions), loads patient context (`patients_pathology.pathology`/`prior_medication`/`surgeries`/`medical_history`/`other_notes` plus diagnosis classifications), then calls the agent sequentially per patient.
- Added `POST /api/clinical-trial-poc/semantic-compare`.

Remaining work:

- Wire into the Match Runner UI once Tasks 9-10 exist and an orchestrator chains deterministic matching, semantic comparison, scoring, and explanation together.

Done when:

- Semantic comparison endpoint or service exists. [done]
- Output matches `API_CONTRACT.md`. [done]

### Task 9: Implement Eligibility Scoring

Status: Completed (storage deferred to Task 12)

Goal:

Create scoring logic that combines deterministic and semantic outputs.

Completed work:

- Added `eligibilityScoringService.js`: a plain, auditable formula (not an OpenAI call) combining `deterministicResult` + `semanticComparison` into a 0-100 score and status.
- Added `POST /api/clinical-trial-poc/score-eligibility` and a `GET /full-match-debug/:trialId` debug route chaining Tasks 7-9 for one-URL testing.
- **v2 revision** (2026-07-06, see `DECISIONS.md`): hard exclusions were banded into `[0, 25]`, semantic conflicts/concerns gained severity ratings, semantic components were ratio-normalized, and any `High`-severity conflict forced "Needs Review".
- **v3 revision** (2026-07-10, see `DECISIONS.md`): active scoring now uses fixed weighted clinical buckets for non-hard-excluded patients: Objective eligibility 25%, Core clinical fit 35%, Clinical exclusion safety 25%, and Additional trial / criteria fit 15%. The semantic comparison agent now returns `criteriaAssessments` so the scoring service can map semantic outcomes into those buckets.
- **2026-07-09 clinical ranking refinement**: target-condition/pathology absence now receives an additional semantic rank penalty, and uncertain threshold/lab conflicts such as missing eGFR or HbA1c are scored as Medium-weight review items rather than confirmed High-weight exclusions while preserving the original semantic note.

Expected work:

- Accept deterministic result and semantic comparison. [done]
- Produce score from 0 to 100. [done]
- Produce match status. [done]
- Make hard exclusion logic visible. [done, via `scoreBreakdown.penalties`]
- Store patient-trial match outputs with enough source version/hash information to support incremental reruns. [deferred to Task 12, which owns storage/incremental-rerun logic]

Done when:

- Scoring endpoint or service exists. [done]
- Output includes score and status. [done]

### Task 12: Implement Incremental Match Result Storage

Status: Partially implemented

Goal:

Store match pipeline outputs so new or updated patients can be evaluated against existing trials without rerunning old current patient-trial matches.

Completed work:

- Added backend persistence for generated ranked dashboard rows in `clinical_trial_match_results`.
- Added `GET /api/clinical-trial-poc/ranked-patients/:trialId` so the Flutter dashboard can reload saved results without rerunning AI calls.
- Updated `POST /api/clinical-trial-poc/ranked-patients` to save/update each selected batch after the scoring/explanation pipeline finishes.
- Updated the Flutter dashboard to treat saved ranked rows as the source of truth and skip already-saved patient IDs when running the next batch.
- Added "Refresh Saved Results" in the Flutter dashboard so existing saved rows can be recomputed and overwritten after scoring or prompt changes, without deleting and recreating the trial.
- Saved-result refresh is required after scoring or prompt changes because `GET /ranked-patients/:trialId` reads stored rows and re-ranks them by stored score rather than recomputing automatically.
- Trial delete already removes `clinical_trial_match_results`, so deleting a clinical trial also clears its saved ranked dashboard.

Expected work:

- Add a POC-specific result table such as `clinical_trial_match_results`. [done in local schema]
- Store `trial_id`, `patient_id`, deterministic result JSON, semantic result JSON, score/status, explanation JSON, and timestamps. [done]
- Track patient context and trial criteria hashes or version fields.
- Skip reruns when a patient-trial result is already current. [partially done by saved patient IDs; not yet hash/version-aware]
- Mark existing results stale when patient context or trial criteria changes.

Done when:

- Backend can save and retrieve patient-trial match results. [done]
- Backend can identify which patient-trial pairs need refresh.
- Ranked dashboard can read stored results instead of recomputing everything every time. [done for already-saved rows]

### Task 10: Implement Explanation and Recommendation

Status: Completed

Goal:

Generate explanation and suggested actions for each patient.

Completed work:

- Added `explanationAgent.js`: an OpenAI call (one patient per call) that explains an already-computed score/status using the deterministic and semantic detail as grounding, without recomputing or second-guessing them, and without stating a final medical/enrollment decision.
- Added `explanationService.js`, which runs the agent sequentially per patient and separately derives `primaryAction` deterministically from `status` (not from the model), so the dashboard's action button stays a small, consistent set.
- Added `POST /api/clinical-trial-poc/explain-recommend`.

Expected work:

- Accept score, deterministic details, and semantic comparison. [done]
- Produce human-readable explanation. [done]
- Produce suggested actions. [done]
- Avoid presenting result as final medical decision. [done, enforced in the prompt]

Done when:

- Explanation endpoint or service exists. [done]
- Output can be displayed in dashboard. [done, see Task 11]

### Task 11: Implement Ranked Patient Dashboard

Status: Completed (stored result readback added; stale-result detection remains Task 12)

Goal:

Build the Flutter dashboard that ranks patients by match score.

Completed work:

- Added `POST /api/clinical-trial-poc/ranked-patients`, the real production endpoint chaining deterministic matching + semantic comparison + eligibility scoring + explanation for selected candidate patients against a trial, ranked by score.
- The trial detail page's "Match Runner" section is now the full Ranked Patient Match Dashboard: Rank, Patient, Match Score (colored dot + progress bar), Match Status (colored pill), Deterministic Match Summary (readable bullets), Explanation (with a full-detail dialog), and Suggested Next Step (colored action button + guidance caption), plus a color legend - modeled on the team's mockup.
- The dashboard title has a clickable matching-process info control instead of always-visible descriptive text. The dialog explains which trial criteria are handled by deterministic matching versus AI-assisted semantic matching, and explains that semantic matching interprets clinical meaning rather than exact text matches.
- Colors are a shared 3-way bucket (green/amber/red for Strong-or-Likely/Needs-Review/Weak-or-Not-Eligible) across the score dot, status pill, and action button.
- Deterministic and semantic information are visually distinguished: the summary bullets come from deterministic matching, the explanation paragraph and suggested actions come from the semantic + explanation agents.
- Added batch selection before running the expensive ranked pipeline: next 10, next 20, or all remaining patients without saved ranked results, with a progress modal while the batch runs.
- Saved ranked results reload on the trial detail page through Task 12's stored-result endpoint, so the dashboard persists across page refreshes/backend restarts.
- Added a guard for older trials without saved supplemental criteria; the dashboard explains that these must be re-input through the current create-trial flow before ranked matching can run. New uploaded and manually entered trials both save semantic criteria.
- The trial detail page's Detailed Information table includes a clickable row for viewing saved Additional Trial / Criteria Information Not Captured by the Base Form, using the saved semantic criteria read endpoint.

Remaining work:

- Running a new batch still computes that selected batch live (two sequential OpenAI calls per patient), but already-saved rows are read from `clinical_trial_match_results`.
- Persisted freshness, cross-session "recently updated patients," and hash/version-based stale detection require the remaining Task 12 work.
- Deterministic summary bullets are generic per field name rather than carrying the patient's actual matched value (e.g. "Age matches trial criteria" rather than "Age 52 is within required range") - see `CHANGELOG.md` notes; would require extending `deterministicMatchingService.js`'s already-shipped output shape.

Done when:

- Dashboard displays sample or live backend data. [done, live backend data]
- User can review ranked patient results. [done]
