# Architecture

## Overview

This project is an agentic clinical trial matching proof of concept built around two main application layers:

1. A standalone Flutter frontend.
2. A copied version of the existing e-Hospital backend.

The POC enhances the existing e-Hospital clinical trials component by adding a multi-agent workflow for clinical trial document extraction, supplemental criteria interpretation, semantic patient-trial comparison, eligibility scoring, explanation generation, and ranked patient review.

## High-Level System Flow

Clinical trial document upload/input flows through the following process:

1. User uploads or provides a clinical trial PDF/DOCX.
2. Clinical Trial Document Field Extractor extracts required structured trial fields.
3. Supplemental Criteria Interpretation Agent extracts additional medically relevant trial information.
4. Deterministic matching compares objective structured trial criteria against patient database fields.
5. Semantic Patient-Trial Comparison Agent compares multi-value/free-text clinical trial criteria and supplemental criteria against patient clinical information.
6. Eligibility Scoring Agent combines deterministic and semantic outputs.
7. Explanation and Recommendation Agent explains the score and suggests actions.
8. Ranked Patient Dashboard displays patient results.

## Existing System Foundation

The existing e-Hospital clinical trials component already contains:

- Clinical trial dashboard modules
- Clinical trial listing
- Clinical trial creation
- Clinical trial detailed information
- Partnership patients module
- Advanced patients match
- Patient profile view
- Clinical trial action management
- Hardcoded/deterministic patient matching logic

This POC should build on those ideas and data structures rather than replacing them with an unrelated design.

## Frontend Architecture

The frontend is built from scratch in Flutter.

Frontend responsibilities:

- Gate the app behind the Pharmaceutical Office login screen.
- Restore or clear a stored Pharma company session from browser storage.
- Provide document upload or document input interface.
- Display extracted required trial fields.
- Display supplemental criteria extracted from the trial document.
- Allow review or editing of extracted trial information, including additive add/edit controls for structured supplemental criteria without flattening uploaded criteria into manual text.
- Trigger patient matching workflow.
- Display ranked patient results.
- Display match score, status, explanation, and suggested actions.

The Flutter frontend should communicate with the backend through explicit API endpoints documented in `API_CONTRACT.md`.

## Pharmaceutical Office Authentication

The standalone Flutter app uses the copied backend's original `POST /api/users/login` endpoint with `selectedOption = "Pharma"`. This preserves the original e-Hospital pharmaceutical-company login branch instead of introducing JWTs, OAuth, new roles, or new auth tables.

On startup, Flutter restores a stored Pharma company identity from browser session storage first and local storage second. "Remember Me" stores the company identity in local storage; otherwise the login lasts only for the current browser session. Malformed or non-Pharma stored entries are rejected and cleared.

After login, the authenticated company identity becomes the source of truth for company-scoped API calls such as trial lists, trial creation, trial editing, and pharmaceutical invite actions. The previous fixed `PHARMA_COMPANY_ID` and `PHARMA_COMPANY_NAME` dart-define approach is no longer used for the running app. Logout clears stored login state and returns to the login screen.

## Backend Architecture

The backend is a copied version of the existing e-Hospital backend.

Backend responsibilities:

- Accept uploaded trial documents or document-derived text.
- Extract required clinical trial fields.
- Extract supplemental medically relevant criteria.
- Access or simulate patient data.
- Run deterministic matching using objective structured fields that align cleanly between trial and patient records.
- Run or coordinate semantic comparison.
- Produce eligibility scores and statuses.
- Produce explanations and suggested actions.
- Return ranked patient results to the frontend.

Backend changes should be isolated and documented in `BACKEND_CHANGES.md`.

## Agent Architecture

### Clinical Trial Document Field Extractor

Input:

- Parsed uploaded clinical trial document text, or exact manually typed create-trial criteria text from the manual-only Additional Trial / Criteria Information Not Captured by the Base Form field.

Output:

- Required clinical trial fields.
- Trial name.
- Existing hardcoded inclusion criteria.
- Existing hardcoded exclusion criteria.
- Safe extraction diagnostics, including fresh-run confirmation, shortened input fingerprint, model, system fingerprint when available, and extractor/preprocessing versions.

Role:

- Map trial document content into existing structured e-Hospital fields.
- Normalize uploaded PDF/DOCX/JSON/TXT/MD text deterministically before each fresh agent call; fingerprints are diagnostics only and are not used to cache or skip extraction.

### Supplemental Criteria Interpretation Agent

Input:

- PDF or DOCX clinical trial document.

Output:

- Additional medically relevant trial criteria not captured by hardcoded fields.
- Criteria normalized to the fixed supplemental checklist order with canonical categories, stable relevance values, and exact duplicate removal.

Role:

- Extract nuanced eligibility details from uploaded documents or manual trial descriptions without duplicating structured form fields.
- Run freshly on every upload after the field extractor. User-added or user-edited criteria remain in the same saved semantic criteria row and do not trigger another AI extraction call.

### Semantic Patient-Trial Comparison Agent

Input:

- Multi-value/free-text clinical trial criteria and supplemental trial criteria.
- Patient clinical context, including diagnosis/pathology, diagnosis classifications, medications, surgeries, medical history, and notes.

Output:

- Summary of medically relevant eligibility considerations.

Role:

- Compare nuanced trial information against patient context.
- Identify conflicts, matches, missing information, or concerns.
- Do not generate final score or recommended actions.

### Eligibility Scoring Agent

Input:

- Deterministic matching output.
- Semantic comparison summary.

Output:

- Match score from 0 to 100.
- Match status.

Role:

- Combine rule-based and semantic outputs into a patient-level result.
- Keep numeric scoring auditable and deterministic; this is a formula, not an LLM call.
- Use the v3 weighted clinical model for non-hard-excluded patients: Objective eligibility 25%, Core clinical fit 35%, Clinical exclusion safety 25%, and Additional trial / criteria fit 15%.
- Keep confirmed hard deterministic exclusions in a separate 0-25 Not Eligible band so they cannot be averaged away by other support.
- Penalize serious semantic conflicts through per-criterion AI assessments while still preserving the semantic agent's original notes for human review.

### Explanation and Recommendation Agent

Input:

- Match score.
- Deterministic match details.
- Semantic comparison summary.

Output:

- Explanation of the match score.
- Suggested actions.

Role:

- Make the result understandable for human review.

### Ranked Patient Dashboard

Input:

- Patient-level match results.

Output:

- Ranked list of patients with match score, status, explanation, and suggested actions.

Role:

- Help users prioritize patients for review.

## Deterministic Matching Layer

The deterministic matching layer should use existing structured fields only when they are objective and line up cleanly between trial and patient records.

Current POC ranked-matching field map:

| Trial source | Patient source | Method | Missing value handling | Hard failure? | Score contribution |
| --- | --- | --- | --- | --- | --- |
| `clinical_trials.gender` | `patients_registration.Gender` | Deterministic exact rule; `Both` matches any patient gender | Missing patient gender adds `gender` to `missingFields` and receives no objective credit | Yes, when trial gender is not `Both` and differs from patient gender | Objective eligibility bucket, 25% total across deterministic fields |
| `clinical_trials.age_range` | `patients_registration.Age` | Deterministic numeric range check using `min-max` text | Missing patient age adds `age` to `missingFields` and receives no objective credit | Yes, when age is outside the parsed range | Objective eligibility bucket, 25% total across deterministic fields |
| `clinical_trials.exclusion_criteria.BMI` | `patients_registration.height` and `patients_registration.weight`, converted to BMI | Deterministic allowed-range check; accepts two-sided and one-sided text such as `> 18 and < 35` or `< 35` | Missing height/weight or unparseable BMI range adds `bmi` to `missingFields` and receives no objective credit | Yes, when calculated BMI is below the allowed minimum or above the allowed maximum | Objective eligibility bucket, 25% total across deterministic fields |
| `clinical_trials.exclusion_criteria.Pregnancy` | `patients_pathology.pregnancies` | Deterministic exclusion only when the trial value is exactly `Yes` | If pregnancy exclusion is `Yes` and patient pregnancy history is missing, adds `pregnancy` to `missingFields`; if unrestricted, pregnancy data is shown as not applicable | Yes, when pregnancy exclusion is `Yes` and patient pregnancies is greater than 0 | Objective eligibility bucket, 25% total across deterministic fields |
| `clinical_trials.related_conditions` | Patient diagnosis/pathology, diagnosis classifications, medical history, and notes | Semantic agent assessment | Missing evidence becomes `Missing` or a conflict depending on clinical importance | Not a deterministic hard failure; High semantic conflicts force `Needs Review` | Core clinical fit bucket, 35% total |
| `clinical_trials.pathology` | Patient diagnosis/pathology, diagnosis classifications, medical history, and notes | Semantic agent assessment; treated as target-condition evidence | Missing target-condition evidence is prompted as a High-severity potential conflict, not support | Not a deterministic hard failure; High semantic conflicts force `Needs Review` | Core clinical fit bucket, 35% total |
| `clinical_trials.exclusion_criteria.Diseases` | Patient diagnosis/pathology, diagnosis classifications, medical history, and notes | Semantic agent assessment | Missing evidence adds missing/review information; absence of an exclusion can be `Not Applicable` | Not a deterministic hard failure | Clinical exclusion safety bucket, 25% total |
| `clinical_trials.exclusion_criteria.Surgeries` | `patients_pathology.surgeries`, medical history, and notes | Semantic agent assessment | Missing surgery evidence adds missing/review information; absence of an exclusion can be `Not Applicable` | Not a deterministic hard failure | Clinical exclusion safety bucket, 25% total |
| `clinical_trials.exclusion_criteria.PriorMedications` / `Prior Medications` | `patients_pathology.prior_medication`, medical history, and notes | Semantic agent assessment | Missing medication evidence adds missing/review information; absence of an exclusion can be `Not Applicable` | Not a deterministic hard failure | Clinical exclusion safety bucket, 25% total |
| `clinical_trial_semantic_criteria.criteria_json.additionalTrialInformation[]` | Combined patient semantic context: diagnosis/pathology, diagnosis classifications, medications, surgeries, pregnancies, medical history, and notes | Semantic agent assessment, one `criteriaAssessments` item per identifiable criterion | Missing patient evidence returns `Missing` and may trigger `Needs Review` when enough semantic evidence is missing | Not a deterministic hard failure; High semantic conflicts force `Needs Review` | Additional trial / criteria fit bucket, 15% total unless category maps to core or exclusion |

As of 2026-07-09, the POC ranked-matching pipeline no longer uses multi-value/free-text clinical fields as exact deterministic checks. `related_conditions`, `pathology`, disease exclusions, surgery exclusions, and medication exclusions remain stored on the trial, but they are passed to semantic comparison because patient records may describe the same clinical concept using different wording.

The deterministic layer returns `matchedFields`, `failedFields`, `missingFields`, `hardExclusionFlags`, and `criteriaDetails`. Missing deterministic values do not create eligibility support. Confirmed hard deterministic failures from gender, age, BMI, or pregnancy cap the score in the 0-25 `Not Eligible` band before the semantic buckets are considered.

## Semantic Matching Layer

The semantic layer should interpret medically relevant information that does not fit neatly into objective deterministic checks, including multi-value/free-text clinical form fields.

Examples:

- Related conditions and target condition/pathology wording
- Disease exclusions
- Surgery exclusions
- Medication exclusions
- Medication stability requirements
- Disease severity
- Prior treatment history
- Lab values
- Recent hospitalization
- Timing of surgeries
- Complex comorbidities
- Other textual eligibility details

The semantic layer should not override hard exclusion criteria without flagging the conflict.

The Semantic Patient-Trial Comparison Agent receives:

- Trial identity and deterministic criteria for reference only: trial name, gender, age range, BMI range, and pregnancy exclusion.
- Semantic trial form criteria: related conditions, pathology/target condition, disease exclusions, surgery exclusions, and medication exclusions.
- Saved supplemental criteria: `clinical_trial_semantic_criteria.summary` and `criteria_json.additionalTrialInformation`.
- Patient clinical context: `patients_pathology.pathology`, diagnosis classifications from `pathology_classifications`, `prior_medication`, `surgeries`, `pregnancies`, `medical_history`, and `other_notes`.

The semantic agent returns `summary`, `supportingFactors`, `potentialConflicts`, `missingInformation`, `concerns`, and `criteriaAssessments`. It does not assign the final ranking, status, or recommended action. The deterministic `eligibilityScoringService.js` consumes `criteriaAssessments` and maps each assessment into the weighted scoring buckets. `Supported` and `Not Applicable` receive full bucket credit; `Missing` receives no credit; `Concern` and `Conflict` receive partial credit based on severity. A High-severity semantic conflict forces `Needs Review`; missing objective fields, semantic-agent unavailability, or at least 30% missing semantic assessments downgrade otherwise Strong/Likely results to `Needs Review`.

Semantic target-condition handling is intentionally strict. If a trial's pathology/target condition is hypertension, a patient record with no hypertension or clinically equivalent related condition should receive a serious semantic conflict and rank below patients with evidence of the target condition. This prevents objective demographic matches such as age, gender, and BMI from floating a clinically mismatched patient to the top.

Semantic threshold/lab handling is intentionally review-oriented. If the semantic output says a threshold value is missing or unknown, such as eGFR, HbA1c, serum potassium, or serum sodium, scoring treats that as missing or reviewable semantic evidence rather than a confirmed exclusion unless the patient record actually contains the failing value. The reviewer-facing text is preserved so the dashboard still shows what needs to be checked.

Semantic trial criteria should be stored separately from `clinical_trials.exclusion_criteria`. The preferred POC implementation is a dedicated table such as `clinical_trial_semantic_criteria`, keyed by `trial_id`, containing structured JSON output, a summary, source type, and timestamps. Uploaded-document trials save `source_type = supplemental_agent` from the Supplemental Criteria Interpretation Agent; manually entered trials save `source_type = manual_form` using the exact manual-only Additional Trial / Criteria Information Not Captured by the Base Form text as the additional criterion, keeping Detailed Description as general overview text and keeping base fields from being duplicated as "additional" criteria.

The Flutter form now treats saved semantic criteria as structured review data in both create and edit modes. Reviewers can add a missing criterion or edit one criterion while preserving every other extracted/manual criterion and its metadata. Uploaded-document criteria keep `source_type = supplemental_agent`; user changes are stored as item-level metadata such as `origin: "user_added"` or `userEdited: true` without schema changes. Semantic comparison consumers continue reading the current `criterion` values and ignore unknown item metadata.

Semantic patient context should initially use existing `patients_pathology.pathology`, `prior_medication`, `surgeries`, `medical_history`, and `other_notes` fields, plus diagnosis classifications from `pathology_classifications` when available, rather than creating a new patient table. These fields should be treated as semantic clinical context for the POC ranked-matching pipeline, not as exact string-match deterministic source-of-truth fields.

## Incremental Matching and Reruns

The matching pipeline should not rerun every patient against every trial on every update.

Preferred behavior:

1. When a new patient is added, run that patient through deterministic matching for active/relevant trials.
2. Run semantic comparison only for patient-trial pairs that pass or nearly pass deterministic screening, or where semantic review is explicitly useful.
3. Store patient-trial match outputs in a dedicated result table such as `clinical_trial_match_results`.
4. Track source versions or hashes for patient context and trial criteria.
5. Skip reruns when an existing patient-trial result is already current.
6. Rerun a patient-trial pair only when patient context changes, trial criteria changes, semantic criteria changes, or a user explicitly requests refresh.

This keeps the workflow cheaper, auditable, and easier to explain.

The current dashboard stores generated rows in `clinical_trial_match_results`. Loading a trial detail page reads those saved rows and re-ranks them by stored score; it does not recompute automatically. If the scoring formula, semantic prompt, trial criteria, or patient context changes, the user should run `Refresh Saved Results` so the same saved patient IDs are sent back through the live pipeline and overwritten.

This POC ranked-matching pipeline is distinct from inherited legacy matching code in `backend_copy/app/controllers/userController.js`. Legacy matched-patient endpoints still contain older direct matching helpers and display text for existing screens. The Flutter ranked dashboard and POC endpoints use `deterministicMatchingService.js`, `semanticComparisonService.js`, `eligibilityScoringService.js`, `explanationService.js`, and `matchResultService.js`.

## Trial Editing and Saved Result Invalidation

Existing trials are edited in place. The Flutter trial detail page opens the shared clinical trial form in edit mode, using the immutable `clinical_trials.trial_id` to load the current database-backed trial row, contact row, and saved semantic criteria. Trial ID is read-only in edit mode because semantic criteria, ranked results, contacts, actions, applications, and other workflow records reference it.

Edit mode includes a top Cancel action. If the loaded form has not changed, Cancel returns to trial detail immediately. If any form, dropdown, masking, document, or semantic-criteria state changed, Cancel and browser/system Back show a discard confirmation; keeping editing preserves all entered changes and discarding returns without calling the update endpoint or changing ranked results.

Document extraction runs as a request-ID-scoped UI lifecycle. Cancel restores the pre-extraction form snapshot, dismisses only the extraction dialog, and rejects late responses from older cancelled requests so they cannot overwrite newer uploads. The current backend/OpenAI call is not guaranteed to abort server-side.

The trial list is client-side paginated over the authenticated company trial list. It defaults to 10 rows per page, offers 10/20/50 rows per page, keeps Trial IDs left-aligned with four-digit formatting, orders columns as Name, ID, Conditions, Phase, Status, Type, Location, Investigator, Sponsor, Ethics, and opens the detail page from any body row cell.

The backend exposes an isolated POC update endpoint, `POST /api/clinical-trial-poc/update-trial`, rather than implementing edit as delete-and-recreate. The endpoint updates `clinical_trials`, updates or creates the associated `clinical_trials_contacts` row, optionally upserts `clinical_trial_semantic_criteria` when the user intentionally changes or replaces additional criteria, and preserves `trial_status` so status remains controlled only by the dedicated status endpoint.

Before committing the update, the backend compares the persisted old matching criteria with the normalized incoming matching criteria. Eligibility-related changes include related conditions, pathology/target condition, age range, gender, BMI, disease exclusions, surgery exclusions, medication exclusions, pregnancy exclusion, and saved semantic criteria content. General fields such as contact information, trial name, summaries, dates, masking, location, sponsor, investigator, ethics approval, and trial status do not invalidate saved ranked rows by themselves.

When eligibility criteria changed, the transaction deletes only `clinical_trial_match_results` rows for that trial. It does not delete the trial, patient profiles, invitations, actions, applications, workflow history, or the newly updated semantic criteria. When only general information changed, saved ranked rows remain intact and the dashboard reloads the existing stored results.

The ranked dashboard exposes Match Next 10 Patients and Match All Patients. For new runs, the backend selects only patients without a saved row for the trial; Next 10 is capped server-side and ordered by patient ID, while All processes every remaining unmatched patient after a frontend confirmation. Refresh Saved Results is the only path that sends explicit patient IDs and intentionally overwrites existing saved rows.

## Data Flow

Expected data flow:

1. Document input enters the backend.
2. Backend extracts structured required fields.
3. Backend extracts supplemental criteria.
4. Backend retrieves or receives patient data.
5. Backend performs deterministic matching.
6. Backend performs semantic comparison.
7. Backend scores patients.
8. Backend generates explanations and suggested actions.
9. Frontend displays ranked patient results.

## Reintegration Considerations

Because the backend is copied rather than forked, backend changes may need to be manually reintegrated into the original backend repository later.

To support future reintegration:

- Keep backend changes isolated.
- Track changed backend files in `BACKEND_CHANGES.md`.
- Avoid unrelated backend refactoring.
- Prefer new clinical trial matching modules over changes to shared core files.
- Document new dependencies and environment variables.
