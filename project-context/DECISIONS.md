# Decisions

This file records important project decisions and the reasoning behind them.

## 2026-07-28 - Lowercase Clinical Trial Action/Patient Table Names for Case-Sensitive Production MySQL

Decision:

All references to the four clinical-trial workflow tables are now lowercase everywhere in code and SQL: `clinicaltrials_actions`, `clinicaltrials_actionrequests`, `clinicaltrials_actionresponses`, and `clinicaltrials_patients`. The previous mixed casing (`ClinicalTrials_Actions` in JavaScript, lowercase in the actual databases) is not permitted.

Reasoning:

MySQL's `lower_case_table_names` setting decides whether table names are case-sensitive. Windows installs default to `1` (case-insensitive, names folded to lowercase on disk). Linux installs — including the AWS RDS instance hosting the production `PRD01` database — default to `0`, making table names case-sensitive.

The copied e-Hospital backend queries these four tables in CamelCase while the tables themselves are stored lowercase. That is invisible during local Windows development and fails immediately against `PRD01` with `ER_NO_SUCH_TABLE`.

On 2026-07-28 this single mismatch produced three unrelated-looking symptoms:

1. Trial creation returned a failure even though the trial row committed. `createNewClinicalTrials` inserts into `clinical_trials` and then into the actions table, without a wrapping transaction, so the trial persisted while the endpoint reported an error.
2. Supplemental criteria were never saved. The Flutter create flow awaits trial creation before calling `save-semantic-criteria`, so the thrown error skipped the save entirely. The resulting trials then reported "no semantic data" during ranked matching.
3. Trial deletion reported "doesn't exist". The UI surfaced the raw backend message verbatim; the missing object was the table, not the trial.

Alternatives considered:

- Renaming the tables in `PRD01` to CamelCase. Rejected: it is a shared production database, and renaming would break the real e-Hospital application.
- Setting `lower_case_table_names=1` on the RDS instance. Rejected: on MySQL 8 this cannot be changed after instance creation, and it is not our instance to reconfigure.
- Leaving the copy byte-faithful to upstream. Rejected: the POC has to run against `PRD01`, and lowercase names work correctly in both environments — exact match on Linux, case-insensitive match on Windows.

Consequences:

This is a latent bug in the original e-Hospital backend, not something this project introduced. All 33 CamelCase references in `userController.js` were present in the original import (commit `3397e21`); the 5 in `clinicalTrialPocController.js` are ours, having copied the surrounding convention. The same failure would affect the upstream backend against any case-sensitive MySQL, so this fix is a candidate to send upstream rather than a POC-only divergence.

Related: `patients_pathology` in `PRD01` has no `medical_history` or `other_notes` columns. The semantic comparison service reads them defensively (`row.medical_history || null`), so their absence degrades semantic match quality without raising an error. `PRD01` does contain dedicated `medical_history`, `family_history`, `surgical_history`, and `allergy_records` tables, but all four are empty, so rewriting queries against them would gain nothing today.

## 2026-07-15 - Fresh Extraction Consistency and Additive Supplemental Criteria Editing

Decision:

Every document upload runs a fresh document parse, a fresh Clinical Trial Document Field Extractor call, and a fresh Supplemental Criteria Interpretation Agent call. Document fingerprints are returned only as safe diagnostics and must not become cache keys. Extraction consistency is improved with deterministic preprocessing, stricter prompts, `temperature: 0`, strict JSON Schema response format for explicitly supported model names, and a fixed configurable `OPENAI_EXTRACTION_SEED` only for allow-listed models.

The Flutter form treats supplemental criteria as structured data in create and edit modes. Users can add a missing criterion or edit one criterion while preserving every other extracted/manual item. Uploaded-document rows keep `source_type = supplemental_agent`; user additions/edits are represented as backward-compatible item metadata such as `origin: "user_added"` or `userEdited: true`.

Reason:

The goal is to reduce irrelevant variability between genuinely fresh LLM calls, not to hide variability by reusing old responses. Additive criteria editing lets reviewers correct extraction gaps without discarding structured uploaded-document criteria or forcing them into a lossy manual text field.

Implications:

- No extraction-result cache, document-hash cache, database cache table, or frontend reuse cache should be added for upload results.
- Line endings, supported encodings, repeated whitespace, ClinicalTrials.gov JSON module order, relevant-section selection, and truncation should remain deterministic.
- Remaining model variability is still possible because fresh LLM calls are made; diagnostics expose model/version/fingerprint context for review.
- Adding or editing semantic criteria is eligibility-relevant and participates in the existing trial-edit invalidation warning and transactional ranked-result clearing.
- Unknown metadata on `additionalTrialInformation` items must remain backward compatible with semantic comparison and scoring consumers.

## 2026-07-15 - Preserve Original Pharmaceutical Office Login

Decision:

The standalone Flutter POC uses the copied e-Hospital backend's original `POST /api/users/login` endpoint with `selectedOption = "Pharma"` for Pharmaceutical Office access. The app gates clinical-trial pages behind that login, stores only the authenticated company identity in browser session/local storage, and uses that company identity for company-scoped trial API calls.

Reason:

The request is to reproduce the original pharmaceutical-office login behavior in the standalone POC, not to design a new auth system. Reusing the inherited Pharma login branch keeps the standalone app aligned with the original backend and avoids unrelated JWT/OAuth/MFA/role-table work.

Implications:

- The login UI is Pharma-only and labelled Pharmaceutical Office.
- `PHARMA_COMPANY_ID` and `PHARMA_COMPANY_NAME` dart-defines are no longer the source of runtime company context.
- Remember Me affects only browser storage duration; it does not change backend session behavior.
- The local development seed supplies the demo Pharmaceutical Office credential.
- Future auth hardening should be handled as a separate task and should not be mixed into trial matching or trial editing work.

## 2026-07-15 - Criteria-Based Invalidation for Trial Editing

Decision:

Editing a trial preserves the existing `trial_id` and workflow records. Saved ranked dashboard rows are cleared only when effective eligibility criteria change, based on server-side normalized comparison. General administrative edits do not clear `clinical_trial_match_results`.

Eligibility-related edit fields are related conditions, pathology/target condition, age range, gender, allowed BMI range, disease exclusions, surgery exclusions, medication exclusions, pregnancy exclusion, and saved semantic criteria content. General fields are contact information, trial name, official title, brief summary, detailed description, dates, primary purpose, trial phase, study type, allocation, intervention model, masking, location, sponsor, principal investigator, ethics approval, and trial status.

Reason:

Saved ranked rows are generated from deterministic and semantic eligibility criteria. Keeping them after a criteria-changing edit would pair old rankings with new trial requirements, which is unsafe and misleading. Clearing them for cosmetic or administrative edits would waste expensive AI review work and make the dashboard feel unstable. The backend comparison is authoritative so the frontend warning is not the only source of truth.

Edit cancellation is intentionally non-mutating. The frontend handles no-change cancel, dirty discard confirmation, and browser/system Back protection before any update request is sent, so cancelling cannot change trial data, semantic criteria, status, or ranked results.

Document extraction cancellation is UI-authoritative but not server-authoritative. Cancel restores the pre-extraction snapshot and ignores late responses by request ID; because the current backend/OpenAI stack does not expose an end-to-end abort signal, the server-side request may still complete and be discarded by the client.

Ranked matching selection is server-authoritative. The client asks for `mode = next` or `mode = all`; the server decides unmatched patients from `clinical_trial_match_results`, enforces Next 10, orders by patient ID, and upserts one row per trial/patient. The removed demo control should not be reintroduced as a production workflow.

Implications:

- Trial editing must update existing rows rather than delete and recreate trials.
- `trial_status` remains controlled by the dedicated status endpoint.
- Detailed Description remains a general trial overview, not the source of manual supplemental eligibility criteria.
- `clinical_trial_semantic_criteria` is preserved exactly when untouched and upserted only when intentionally changed or replaced.
- Adding, editing, or deleting individual supplemental criteria updates the same semantic criteria JSON row. Deleting the final criterion leaves a valid empty `additionalTrialInformation` array rather than deleting the row or adding a new schema concept.
- Criteria-changing edits delete only `clinical_trial_match_results` rows for the edited trial; invitations, actions, applications, patients, and semantic criteria are preserved.
- Normalization handles null/empty values, whitespace, compatible medication-exclusion key variants, BMI formatting, and semantic JSON object key order so no-op saves do not clear results.

## 2026-07-10 - Weighted Clinical Eligibility Scoring (v3)

Decision:

The active ranked-matching score now uses a fixed weighted clinical model for non-hard-excluded patients: Objective eligibility 25%, Core clinical fit 35%, Clinical exclusion safety 25%, and Additional trial / criteria fit 15%.

Reason:

The POC moved most clinically meaningful criteria into semantic matching, so the older deterministic-base-plus-small-semantic-adjustment model underweighted clinical meaning. Target condition, related conditions, disease exclusions, surgery exclusions, medication exclusions, and Additional Trial / Criteria Information Not Captured by the Base Form now need to carry most of the score. A fixed table is also easier for users to understand in the Ranked Patient Match Dashboard info dialog.

Implications:

- Confirmed hard deterministic exclusions still cap the score in the 0-25 Not Eligible band.
- The Semantic Patient-Trial Comparison Agent now returns `criteriaAssessments` for each semantic criterion, including category, outcome, severity, and explanation.
- The Eligibility Scoring Agent maps those assessments into the v3 buckets and scores outcomes as Supported, Conflict, Concern, Missing, or Not Applicable.
- Older semantic outputs without `criteriaAssessments` fall back to a coarse legacy estimate so debug paths and stored older rows do not crash, but saved ranked rows should be refreshed to use the v3 model.

## 2026-07-09 - Move Multi-Value Clinical Text Fields Into Semantic Matching

Decision:

The POC ranked-matching pipeline keeps deterministic matching, but narrows it to objective fields that align cleanly between trial and patient records: gender/sex, age range, BMI range, and pregnancy exclusion. Multi-value/free-text clinical fields from the trial form (`related_conditions`, `pathology`, disease exclusions, surgery exclusions, and medication exclusions) are now treated as semantic clinical criteria rather than exact deterministic string-match rules.

Reason:

During development, the trial form moved several clinical fields from fixed dropdowns to editable comma-separated text/autocomplete fields. That better reflects real trial documents, which can list multiple diseases, surgeries, medications, related conditions, or target-condition phrases. However, exact deterministic matching becomes brittle when the trial says one phrase and the patient record uses another clinically related phrase, such as "renal impairment" versus "CKD stage 3" or "cardiovascular disease" versus "prior myocardial infarction." Keeping these fields as exact string checks could create both false matches and missed matches.

Implications:

- `deterministicMatchingService.js` no longer checks pathology, diseases, surgeries, or medication exclusions in the POC ranked-matching pipeline.
- The semantic comparison input now includes trial related conditions, pathology/target condition text, disease exclusions, surgery exclusions, medication exclusions, saved supplemental criteria, and patient diagnosis/pathology, diagnosis classifications, medications, surgeries, medical history, and notes.
- Scoring still combines deterministic and semantic outputs. Deterministic hard exclusions remain decisive for objective hard checks such as gender, age, allowed BMI range, and pregnancy exclusion, while semantic clinical conflicts can drive penalties and `Needs Review`.
- The copied backend's legacy matching paths in `userController.js` remain separate so existing screens are not refactored as part of this POC boundary change.

## 2026-07-09 - Ranked Matching Scoring Refinements for Semantic Clinical Criteria

Decision:

The ranked-matching score keeps using the deterministic + semantic scoring formula, but applies extra interpretation rules for semantic clinical conflicts:

1. A patient who lacks evidence of the trial's target condition/pathology receives an extra target-condition-absence penalty.
2. Any High-severity semantic conflict receives an extra rank penalty and forces `Needs Review`.
3. High-severity conflicts that are really uncertain threshold checks, such as "eGFR not provided" or "HbA1c missing," are downgraded to Medium scoring weight while keeping the original reviewer-facing conflict text.
4. Saved ranked rows are treated as persisted outputs; after scoring or prompt changes, users should use `Refresh Saved Results` to recompute and overwrite existing rows.

Reason:

Manual testing with the uploaded NCT05769608 hypertension trial showed two opposite failure modes. First, patients without hypertension could rank too high if they matched objective fields such as age, gender, and BMI. Second, patients with the target condition and medication regimen could be over-penalized when the semantic agent labeled missing threshold data as a High conflict, even though the record did not prove the exclusion was met. The scoring layer now distinguishes "wrong target population" from "needs lab confirmation."

Implications:

- For target-condition trials, a patient with no evidence of the target diagnosis should fall below patients who have the target diagnosis, even if all objective deterministic fields match.
- Missing labs or thresholds should drive `Needs Review`, but should not be scored as a confirmed exclusion unless the patient record actually shows the failing value.
- The semantic comparison text remains visible and unchanged for human review; the scoring service only normalizes how some conflicts affect the numeric score.
- Ranked result order can change after scoring logic changes only after the saved rows are refreshed or regenerated.

## 2026-07-06 - Explanation Is An LLM Call, Scoring Is Not

Decision:

The Explanation and Recommendation Agent (Task 10) is an OpenAI call, unlike the Eligibility Scoring Agent (Task 9), which is a plain formula.

Reason:

Scoring only combines numbers and lists the earlier steps already computed - there is nothing left to interpret, so a formula keeps it auditable. Explanation is different: its entire job is producing fluent, readable language justifying a result to a human reviewer, which is exactly what an LLM is for and not something a formula can do. The agent is explicitly prompted to explain the already-computed score/status using the deterministic and semantic detail as grounding, not to recompute or second-guess them, and never to state a final medical/enrollment decision.

Implications:

- The dashboard's primary action button ("Invite Patient"/"Request Confirmation"/"Do Not Invite") is derived deterministically from `status`, not generated by the LLM, so it stays a small, consistent set instead of the model inventing arbitrary verbs. The model's `suggestedActions` are the supporting detail/caption underneath that button, not the button label itself.
- A per-patient explanation failure degrades gracefully (empty explanation, `error` field set) rather than blocking the rest of the ranked list, same pattern as the semantic comparison agent.

## 2026-06-30 - Build Flutter Frontend From Scratch

Decision:

The frontend for this proof of concept will be built from scratch in Flutter.

Reason:

The project does not need to reuse the existing React frontend. A standalone Flutter app allows the team to focus on the POC workflow: document intake, extracted criteria review, patient ranking, explanation, and suggested actions.

Implications:

- The frontend can be developed independently.
- The frontend should use `API_CONTRACT.md` as the source of truth.
- Existing React pages may still be useful as reference for clinical trial fields and workflows.

## 2026-06-30 - Copy Backend and Track Changes Manually

Decision:

The project will use a copied version of the existing e-Hospital backend rather than a forked backend branch.

Original backend:

https://github.com/ottawa-ehospital/E-react-node-backend

Reason:

This is simpler for group collaboration and initial POC development.

Risk:

Manual reintegration may be required later if backend changes need to move back into the original backend.

Mitigation:

- Keep backend changes isolated.
- Track all backend changes in `BACKEND_CHANGES.md`.
- Avoid broad backend refactoring.
- Prefer new POC-specific routes/services/controllers over changes to existing files.

## 2026-06-30 - Preserve Deterministic Matching Layer

Decision:

The project will preserve deterministic matching as a separate layer and add semantic AI comparison as a supplement.

Reason:

The existing system already uses structured fields for matching. Deterministic matching is explainable and important for hard eligibility criteria.

Implications:

- AI semantic comparison should not replace hardcoded matching.
- Scoring should consider both deterministic and semantic outputs.
- Explanations should distinguish structured matching results from semantic comparison results.

## 2026-07-03 - Use a Local Synthetic Database for Backend Development

Decision:

The project will include a shareable local MySQL development kit under `backend_copy/local-dev/`.

Reason:

The copied backend expects database configuration files that can point to real remote databases. For safe project development, group members should not run local backend changes against an unknown or shared remote database, especially when testing write operations such as creating trials, creating invitations, or adding patient data.

The local development kit provides a minimal schema and synthetic seed data that supports the current clinical trial frontend/backend flow without exposing credentials or real patient information.

Implications:

- Local development should prefer `backend_copy/local-dev/schema.sql` and `seed.sql`.
- Real `backend_copy/app/config/db.config.js` and `mongodb.config.js` files remain private and uncommitted.
- The local schema is intentionally not a full e-Hospital production schema.
- The local seed data is synthetic and safe to share.
- MongoDB is disabled for the local clinical trial POC path unless a developer is intentionally working on copied backend imaging routes.
- Future backend changes should preserve this safe local development path where practical.

## 2026-07-05 - Store Semantic Trial Criteria Separately

Decision:

Supplemental semantic trial criteria should not be stored inside `clinical_trials.exclusion_criteria`.

Reason:

The copied backend already uses `clinical_trials.exclusion_criteria` for deterministic matching. Overloading that JSON with agent-generated semantic criteria would make hardcoded matching harder to reason about and could break existing clinical trial flows.

Preferred implementation:

- Keep `clinical_trials` as the source for core trial identity, structured fields, descriptions, and deterministic inclusion/exclusion data.
- Add a POC-specific table later, such as `clinical_trial_semantic_criteria`, to store Supplemental Criteria Interpretation Agent output.
- Store the agent output as structured JSON plus a short summary and timestamps.
- Use `detailed_description` as source/context text only, not as the canonical structured semantic output.

Draft table shape:

```sql
clinical_trial_semantic_criteria
- id
- trial_id
- source_type
- criteria_json
- summary
- created_at
- updated_at
```

Implications:

- Deterministic matching remains isolated from semantic matching.
- The semantic pipeline can evolve without changing existing clinical trial CRUD behavior.
- Local schema changes for this table should be documented as POC additions, not assumed production migrations.

## 2026-07-05 - Use Incremental Patient Matching Runs

Decision:

Future matching/ranking runs should be incremental. New or meaningfully updated patients should be evaluated against existing clinical trials, but previously evaluated patient-trial pairs should not be rerun unless their source data or the trial criteria changed.

Reason:

The patient set and trial set can both change over time. Reprocessing every patient against every trial after each update would waste cost, create noisy duplicate results, and make it harder to audit why a score changed.

Preferred implementation:

- Store patient-trial match outputs in a POC-specific table later, such as `clinical_trial_match_results`.
- Track `patient_id`, `trial_id`, deterministic result JSON, semantic comparison JSON, score/status, explanation, source version timestamps or hashes, and `last_evaluated_at`.
- When a patient is created or clinically updated, enqueue that patient only for active/relevant trials.
- When a trial's deterministic criteria or semantic criteria change, enqueue all active candidate patients for that trial.
- If a patient-trial result already exists and neither patient context nor trial criteria changed, skip rerunning it.

Draft table shape:

```sql
clinical_trial_match_results
- id
- trial_id
- patient_id
- deterministic_result_json
- semantic_result_json
- score
- status
- explanation_json
- patient_context_hash
- trial_criteria_hash
- last_evaluated_at
- created_at
- updated_at
```

Implications:

- Existing matches can be reused safely.
- Updated patients can be evaluated without rebuilding the entire dashboard.
- The dashboard can show stale/needs-refresh results if source hashes no longer match.

## 2026-07-06 - Ratio- and Severity-Based Eligibility Scoring (v2)

Decision:

Revised the Eligibility Scoring Agent's formula (`eligibilityScoringService.js`) after manual review of real output surfaced three problems with the first version:

1. Hard exclusions flattened every excluded patient to the same flat score (5), destroying ranking ability for strict trials where many patients trip at least one exclusion.
2. Semantic penalties/bonuses were flat points-per-item, which scales with how many supplemental criteria a trial happens to have - a thoroughly-documented trial mechanically generates more possible conflicts/concerns/missing-information items than a sparse one, systematically penalizing (or rewarding) patients based on trial documentation depth rather than actual fit.
3. The score had a hard floor/ceiling at exactly 0/100 with no sense that true extremes should be rare.

Fixes:

- Hard-excluded patients are now banded into `[0, 25]`, scaled by how well they otherwise matched, instead of a flat 5. Status is still unconditionally forced to "Not Eligible" for this band - only the score's fine-grained position within it is graded, never the eligibility conclusion.
- Non-excluded patients score in `[25, 100]`.
- Semantic conflicts and concerns now carry a `severity` rating (`High`/`Medium`/`Low`) from the Semantic Comparison Agent (a trivial detail no longer costs the same as a potentially disqualifying one), and every semantic component (support/conflict/concern/missing) is normalized as a **ratio against that trial's total supplemental criteria count**, not a flat count - fixing the cross-trial bias.
- The final composite score passes through a `tanh` compression (`50 + 50×tanh((raw−50)/35)`) so 0 and 100 are asymptotic rather than trivially reachable.
- Any `High`-severity conflict unconditionally forces status to "Needs Review," regardless of score tier, since a serious flag means "get a human to look at this," not "this is generally a weak match."

Reason:

The Eligibility Scoring Agent is deliberately algorithmic, not an OpenAI call (see the "why not an LLM" reasoning already in `eligibilityScoringService.js`'s file header), specifically so the score stays auditable. That auditability requirement is exactly why these problems were fixable by inspection - a black-box LLM score would have hidden the same bias without a way to trace it.

Implications:

- `POST /api/clinical-trial-poc/score-eligibility` now requires `totalSupplementalCriteriaCount` in its request body to compute the ratios; omitted or `0` degrades gracefully to no semantic adjustment rather than a divide-by-zero.
- `scoreBreakdown` now includes `rawScoreBeforeCurve` so the curve step itself is auditable, not an opaque final jump.
- `missingInformation` items still use a flat ratio (no severity) for now - acceptable per team discussion, revisit if it turns out to matter as much as conflict/concern severity did.

## 2026-07-05 - Combine Supplemental Criteria Extraction Into The Existing Upload Endpoint

Decision:

The Supplemental Criteria Interpretation Agent runs against the same uploaded document text as the Clinical Trial Document Field Extractor, inside `POST /api/clinical-trial-poc/extract-trial-fields`, instead of the standalone `POST /api/clinical-trials/extract-supplemental-criteria` endpoint originally drafted in `API_CONTRACT.md`.

Reason:

The user only uploads a trial document once. Adding a second endpoint would require either re-uploading the same file or plumbing the extracted document text back to the frontend and back to the backend again, for no benefit in this POC.

Implications:

- `extract-trial-fields` now returns both `extractedFields` and `supplementalCriteria` in one response.
- The supplemental agent receives the field extractor's output as context so it can avoid repeating hardcoded fields.
- If the supplemental agent call fails, the response still returns the successfully extracted fields; `supplementalCriteria.error` is set instead of failing the whole request.
- Supplemental criteria is preview-only, same as extracted fields: nothing is written to `clinical_trial_semantic_criteria` until the user actually creates the trial, via the new `POST /api/clinical-trial-poc/save-semantic-criteria` call.
- As of 2026-07-10, manually entered trials are the separate exception to the upload-combined design: the Flutter form saves the exact typed "Additional Trial / Criteria Information Not Captured by the Base Form" text with `source_type = manual_form` after trial creation. This does not reintroduce a second upload step; it only supports trials that never had an uploaded document and avoids reclassifying base form fields as additional criteria.

## 2026-07-05 - Keep Structured Deterministic Matching Isolated From userController.js

Decision:

The structured (matched/failed/missing fields, hard exclusion flags) version of deterministic matching lives in a new `deterministicMatchingService.js`, which reimplements the inclusion/exclusion rules rather than modifying `userController.getSingleClinicalTrialsMatchedPatients` or `getSpecificClinicalTrialsMatchedPatientsInternal`.

Reason:

Those existing functions back live, working Flutter screens (advanced patient matching, matched patient descriptions). Changing their return shape risks breaking that UI. The AI working guide also prefers new isolated files over changes to existing shared logic.

Implications:

- Rule logic was initially duplicated between `userController.js` and `deterministicMatchingService.js` rather than shared. As of 2026-07-09, the POC ranked-matching `deterministicMatchingService.js` is intentionally narrower than the legacy `userController.js` paths: it keeps age, BMI, gender, and pregnancy deterministic while clinical text/list fields move to semantic comparison.
- `POST /api/clinical-trial-poc/deterministic-match` is net-new compared with the copied backend's legacy matching endpoints; the ranked-patients pipeline uses the same underlying `deterministicMatchingService.js`.
- If reintegrated upstream, consider unifying the two implementations behind one shared rule module instead of keeping the duplication long-term.
