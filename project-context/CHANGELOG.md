# Changelog

This file tracks meaningful project-level changes.

Do not use this as a replacement for Git history. Git tracks exact file diffs. This file summarizes important milestones for anyone working on the project.

## 2026-07-28

### Fixed

- Lowercased all references to `clinicaltrials_actions`, `clinicaltrials_actionrequests`, `clinicaltrials_actionresponses`, and `clinicaltrials_patients` across `userController.js` (33 references, all inherited from the original e-Hospital import), `clinicalTrialPocController.js` (5 references), `schema.sql`, `seed.sql`, and `trial-0021-demo-patients.sql`.
- This fixes three production symptoms that shared one root cause: trial creation reporting failure after the trial row had already committed, supplemental criteria never being saved (leaving trials that reported "no semantic data" during ranked matching), and trial deletion reporting that the trial "doesn't exist".
- Root cause was MySQL case-sensitive table names on Linux/RDS (`lower_case_table_names=0`) versus case-insensitive on local Windows (`=1`). See `DECISIONS.md` for the full analysis.

### Added

- `backend_copy/local-dev/prd01-schema-check.sql` — read-only `INFORMATION_SCHEMA` verification script for comparing `PRD01` against the tables and columns this POC queries. Safe to run against production.

### Verified against PRD01

- Trial creation, supplemental criteria save and read-back, deterministic matching across 133 patients, and trial deletion all succeed end-to-end.
- All three POC tables (`clinical_trial_semantic_criteria`, `clinical_trial_match_results`, `clinical_trial_id_sequence`) match `DATABASE_CHANGES_SUMMARY.md` exactly, including unique keys and foreign keys referencing `clinical_trials(trial_id)`.
- `pharmaceutical_company.password` is present, so the inherited Pharma login branch works.

### Known gap

- `PRD01.patients_pathology` has no `medical_history` or `other_notes` columns, so semantic comparison runs with less patient context than local development provides. Reads are defensive and do not error. `PRD01`'s dedicated `medical_history`, `family_history`, `surgical_history`, and `allergy_records` tables are all empty.

## 2026-07-15

### Added

- Top edit-mode Cancel action on the clinical trial form. Clean cancels return to trial detail immediately; dirty cancels ask "Discard changes?" and preserve changes when users keep editing.
- Cancel action for document extraction progress. The UI restores the pre-extraction form state and ignores late responses from cancelled extraction request IDs.
- "Match Patients" action menu with "Match Next 10 Patients" and "Match All Patients"; the backend now enforces unmatched-only selection and the Next 10 batch size.
- A focused `npm run validate:matching-modes` script that checks the ranked-patients API guardrails without making OpenAI calls.

- Pharmaceutical Office login for the standalone Flutter app, using the original e-Hospital `POST /api/users/login` endpoint with `selectedOption = "Pharma"`.
- Remember Me support for storing the authenticated Pharma company identity in browser local storage, with one-session login stored in session storage.
- Logout and app-level auth gating so trial list/detail/create/edit/matching screens require a Pharmaceutical Office session.
- Local development compatibility SQL for adding the copied backend's expected pharmaceutical-company password column and configuring the demo Pharma login row.
- Trial editing for the Agentic Clinical Trial Matching POC. The trial detail page now has an Edit Trial action that opens the shared clinical trial form in edit mode with the current database-backed trial, contact information, structured eligibility criteria, masking roles, location, and saved semantic/additional criteria prefilled.
- `POST /api/clinical-trial-poc/update-trial`, an isolated transactional backend endpoint that updates an existing trial and contact row, optionally updates the existing semantic criteria row, preserves immutable Trial ID, preserves company identity, and preserves trial status.
- Server-side normalized criteria-change detection for trial editing. Eligibility-changing edits clear saved ranked rows for that trial; general/administrative edits preserve the saved ranked dashboard.
- A focused `npm run validate:trial-edit` script that validates the pure criteria comparison rules without requiring a database or OpenAI call.
- A focused `npm run validate:extraction-consistency` script that validates deterministic document preprocessing, stable normalized extraction inputs, normalized supplemental criteria ordering, and fresh invocation of both extraction agents without OpenAI calls.

### Changed

- The sidebar account area now displays only the authenticated Pharmaceutical Office email above Logout; the company name remains in auth state and API context but is no longer shown there.
- The Clinical Trial List now defaults to 10 rows per page, offers 10/20/50 page sizes, places Status immediately after Phase, left-aligns Trial IDs, and opens trial detail pages from any body row cell with a visible row hover state.
- Document extraction preprocessing is more deterministic: CRLF/LF line endings normalize identically, repeated whitespace is stabilized, ClinicalTrials.gov JSON is rendered in fixed module/field order, object fallback stringification is stable, and the final agent input receives a diagnostic-only shortened fingerprint.
- The Clinical Trial Document Field Extractor and Supplemental Criteria Interpretation Agent now use `temperature: 0`, explicit prompt/schema version metadata, strict JSON Schema response format for allow-listed OpenAI model names, and a fixed configurable extraction seed only for allow-listed models. Upload responses include safe `extractionMetadata` and still rerun both agents every time.
- The Supplemental Criteria Interpretation Agent now follows a fixed checklist order and backend normalization canonicalizes category names, relevance values, whitespace, exact duplicates, and ordering while preserving clinically distinct criteria.
- The create/edit trial form now lets users add a missing supplemental criterion or edit one existing criterion while preserving all other extracted/manual criteria. Uploaded-document criteria keep `source_type = supplemental_agent`; user additions/edits are saved as backward-compatible item metadata and no extra AI call is made solely for manual edits.
- Company-scoped frontend API calls now use the authenticated Pharma company identity instead of fixed `PHARMA_COMPANY_ID` / `PHARMA_COMPANY_NAME` dart-defines.
- `backend_copy/db_login.js` now maps the copied backend's `mysql` dialect setting to the installed `mysql2` Knex client for compatibility with the local MySQL authentication protocol.
- Local development `pharmaceutical_company` seed data now includes the demo Pharmaceutical Office credential row for `Standalone Pharma`.
- `getSpecificClinicalTrialsInfo` now includes contact aliases so edit mode can prefill contact first/middle/last name, area code, phone number, and email.
- Saved document-extracted semantic criteria are preserved in edit mode unless the user explicitly replaces them or uploads a new document. Manual semantic criteria are shown in the manual additional-criteria field and update the existing semantic row only when changed.
- Trial list status chips are left-aligned to the Status header, fixed-size for every supported trial status, and wide enough for "Under Review" without ellipsis.
- Removed the create/edit form's user-facing "Fill Test Data" control and the trial detail "Rank 5 Patients (Demo)" control.

## 2026-07-11

### Changed

- Replaced the heavier TrialID history-table idea with a minimal single-row `clinical_trial_id_sequence` table. TrialID autofill now reads this persistent next-ID counter, skips currently used IDs, and advances the counter after successful trial creation, so deleting a trial does not make the app suggest that old ID again. Manual TrialID submissions lower than the sequence counter are rejected as already used. Large seeded/NCT-style numeric trial IDs are ignored when initializing the small local sequence.
- Added an optional local demo reset script, `backend_copy/local-dev/trial-0021-demo-patients.sql`, that replaces local synthetic patient rows with 20 trial-0021-focused hypertension demo patients and clears saved ranked match results. The script is data-only and does not change schema.
- The Ranked Patient Match Dashboard saved-results line now displays as a compact metadata panel with clearer updated-date and patient-count chips instead of a raw timestamp sentence.
- The ranked matching batch picker now offers a `Next 20` option when exactly 20 unranked patients are available, matching the optional trial-0021 demo patient set instead of only showing the smaller batch option.
- The Ranked Patient Match Dashboard now includes a `Rank 5 Patients (Demo)` action for live demos. It uses the existing ranked-patients pipeline with a curated five-patient trial-0021 demo set (`1, 3, 5, 13, 11`) so the demo shows a strong match, a good match, a medication-count concern, a hard BMI exclusion, and a clear non-match without changing scoring logic.
- The Ranked Patient Match Dashboard now centers row content under the centered column headers, vertically centers each cell's content block to reduce unused whitespace at the bottom of tall rows, uses shorter left-aligned `Full ...` detail links within dashboard preview columns, uses consistent circular bullet markers across deterministic, semantic, and recommendation sections, and uses shorter table previews. Semantic Summary previews now summarize the full semantic review counts instead of showing the first long text fragment, while "Full semantic summary" still opens the detailed full list. The former Suggested Next Step column is now labeled "Recommendation", displays the verdict as left-aligned plain text such as "Recommendation: Invite Patient" instead of a button-like colored pill, and keeps generated follow-up actions behind "Full next steps".
- The Ranked Patient Match Dashboard "Full next steps" dialog now displays suggested actions as a cleaner numbered review list with styled rows instead of a raw hyphenated text block, matching the more structured deterministic and semantic detail dialogs.
- The Ranked Patient Match Dashboard no longer shows the bottom color legend because recommendation values are now plain text and the previous action-color explanation was no longer accurate.
- The trial detail "Detailed Information" table now displays `Not Applicable` values with the same muted italic empty-state styling used for unspecified exclusion criteria, making non-values visually distinct from entered trial details.
- The ranked deterministic matching service now treats failed objective criteria (`gender`, `age`, allowed BMI range, and pregnancy exclusion) as hard deterministic failures for the ranked pipeline, so the v3 scoring cap actually confines those patients to the 0-25 `Not Eligible` band. BMI parsing was also made more tolerant of common allowed-range strings such as `18 to 40`, `> 18 and < 40`, `> 18 or < 40`, and one-sided allowed ranges such as `> 18` or `< 35`, preventing BMI hard exclusions from being missed or reversed because of display wording.
- The v3 ranked eligibility scoring formula no longer gives score credit for missing information. Missing deterministic fields, semantic `Missing` assessments, unknown semantic outcomes, and unavailable semantic comparison now add zero points while still flagging review/downgrading confidence where appropriate.
- The ranking progress dialog now presents patient progress as a conservative estimate rather than an exact backend-completed count. It advances slowly, stops around the middle of the selected batch with "Reviewing remaining patients" while the backend is still reviewing/scoring, keeps only the simple "This may take a while for large patient sets." note, and only shows completion once the ranked results actually return.
- The Ranked Patient Match Dashboard table now centers all column header labels and body-cell content within their visual columns while vertically centering row content blocks inside tall dashboard rows.
- The Ranked Patient Match Dashboard keeps the compact Deterministic Summary bullets but now adds a `Full deterministic summary` action. The full view opens a criteria/patient-data/result table backed by a new additive `criteriaDetails` array in the deterministic match result, with a fallback for older saved rows.
- The full deterministic summary now keeps patient pregnancy history visible even when the trial pregnancy rule is `Unrestricted`; the result remains `Not Applicable` because pregnancy is not an active exclusion for that trial, but the patient-data column no longer hides the stored pregnancy count. The Flutter dialog also repairs older saved deterministic rows at display time by loading the patient profile from the same database-backed profile endpoint, so the deterministic modal stays consistent with the patient profile and stored patient pathology data.
- The Ranked Patient Match Dashboard full Semantic Summary dialog now groups semantic findings into clear sections for Conflicts, Concerns, Missing, Supports, and Other, using lightly styled rows instead of a plain hyphenated text block. Semantic assessment rows with a criterion now consistently split patient evidence and trial criteria into bold `Patient:` and `Criterion:` lines for easier review.
- The Ranked Patient Match Dashboard summary bullets now use the same body text size as the Explanation preview so row typography is consistent across columns.
- Ranked dashboard patient names now open the same patient detail/profile page used by the older matched-patient table, using the ranked row's patient ID.
- Patient profile pages now display more of the available patient record, including country/address/postal/date-of-birth demographics when present and the matching-relevant clinical context used by semantic review: diagnosis classifications, pregnancies, medical history, and other notes in addition to diagnosis, medications, and surgeries. Patient profiles now calculate and display BMI from structured height/weight fields instead of relying on BMI text in notes, and the profile UI filters known trial-aware/matching commentary out of displayed Other Notes without changing the underlying matching inputs.
- Patient profile Care Team role labels now display backend association values in user-friendly title case, so `family_doctor` appears as `Family Doctor` instead of `family_doctor doctor`.
- Local synthetic patient seed notes were cleaned so patient profiles show patient-only clinical information rather than trial-specific demo labels, excluded-medication commentary, or intended match/non-match wording. The trial-0021 demo cohort still preserves varied structured height/weight, diagnosis, medication, lab, surgery, and note context for matching demonstrations.
- The Ranked Patient Match Dashboard Explanation column and full explanation dialog now focus on clinical rationale only. Suggested next-step/action text is filtered out of displayed explanations, and the Explanation and Recommendation Agent prompt now keeps coordinator actions in `suggestedActions` instead of repeating them in `explanation`.
- The trial detail page no longer shows the older bottom "Matched Patients" table or its custom matching-criteria dialog. Patient matching review now happens through the Ranked Patient Match Dashboard, while ranked patient names still open the patient profile page.
- The shared sidebar no longer shows the disabled AI Workflow group or the trial-detail jump links. Wide layouts keep the sidebar visible, smaller layouts use the app-bar drawer, and the navigation contains only the global Clinical Trials section with Trial List and Create Trial.

## 2026-07-10

### Changed

- Manually entered trials now show an optional full-width bottom section titled "Additional Trial / Criteria Information Not Captured by the Base Form" with helper text that says "For manual entry only: add eligibility details not captured by the form." After trial creation, the exact manually typed text is saved as a `clinical_trial_semantic_criteria` row with `source_type = manual_form` so the ranked matching pipeline can use manual trials too without re-labeling base form fields such as age as additional criteria. Uploaded trials continue to use the supplemental criteria extracted during document upload, and the manual-only section is hidden/cleared for document uploads so Detailed Description remains a general trial overview. The internal API key remains `additionalCriteriaInformation` for compatibility.
- The create-trial form now uses row-based section layouts instead of giving every field the same fixed-width slot. Contact Information now places Email, Phone Number, then Area Code after the name row; Trial Basic Information now uses a full-width Official Title row, a Trial Name/Trial ID row, and a Country/Region row; Descriptions now uses two equal fields for Brief Summary and Detailed Description; Trial Details now groups related design, date, masking, and sponsor/investigator fields; Inclusion Criteria now pairs target condition with related conditions before demographic criteria; and Exclusion Criteria now separates BMI/pregnancy from the wider multi-value clinical exclusions.
- Trial ID auto-fill now uses a persistent local `clinical_trial_id_history` table in addition to the current `clinical_trials` rows. The backend backfills existing Trial IDs, records newly created Trial IDs, treats historically used IDs as unavailable for duplicate checks, and keeps the small four-digit UI sequence moving forward without letting large seeded/public numeric trial IDs force the next editable ID upward. This prevents deleted Trial IDs from being suggested again going forward.
- The create-trial Trial Details section now groups the Masking dropdown with the Mask Participant and Mask Investigator checkboxes in a compact full-width row so masking type and masking roles appear together without pushing unrelated fields downward. Manual masking changes now mirror upload behavior: choosing Double checks both role boxes, choosing None/Open Label clears both, and Single leaves the editable role boxes unchanged.
- The document extraction progress dialog now shows a distinct detail line for the Extract fields step: "Extracting structured trial fields from the document.", so all five progress steps have supporting text without repeating the dialog title verbatim.
- The create-trial extraction status area no longer shows a standalone uploaded filename above the success message, since the success message already includes the filename.
- The create-trial form now uses more neutral default trial-design values: Trial Phase defaults to Not Applicable, Allocation defaults to N/A, and Intervention Model defaults to N/A instead of assuming Phase I, Randomized, and Single Group. Broader defaults such as Treatment, Interventional, Both, Unrestricted, and None (Open Label) remain unchanged.
- The Clinical Trial List now constrains table cell widths and truncates long text with ellipses, with hover tooltips for the full value, so verbose fields no longer create an extremely wide horizontal scroll.
- The Ranked Patient Match Dashboard no longer shows a persistent explanatory sentence under the title or a running-state note in the dashboard body. The ranking progress dialog now shows "This may take a while for large patient sets." near the current "Ranking patient X of Y" step, removes that note during finalizing, and includes a Cancel action during active ranking that closes the dialog, stops local progress, restores the visible dashboard state from before the run, and ignores any late response from that cancelled request. A clickable info icon beside the title now opens a more organized matching-process explanation with bold section headers and bullet-style pipeline steps for the Deterministic Matching Agent, Semantic Patient-Trial Comparison Agent, Eligibility Scoring Agent, and Explanation and Recommendation Agent. The dialog also separates deterministic matching (gender, age range, allowed BMI range, pregnancy exclusion) from AI-assisted semantic matching (target condition, related conditions, disease/surgery/medication exclusions, and Additional Trial / Criteria Information Not Captured by the Base Form), notes that semantic matching compares clinical meaning rather than exact text matches, includes a table-style scoring-weight section that mirrors the v3 scoring formula, and explains that refreshed scores can move because Refresh Saved Results reruns AI semantic comparison/explanation while the deterministic scoring formula recalculates from those new semantic assessments. The same explanation notes that strong candidates should generally remain in similar positions, while large ranking changes usually indicate the refreshed semantic review found meaningfully different clinical support or concern. The v3 weights remain Objective eligibility 25%, Core clinical fit 35%, Clinical exclusion safety 25%, and Additional trial / criteria fit 15%, with hard deterministic exclusions still capped in the 0-25 Not Eligible band.
- The ranked dashboard now places Suggested Next Step before Explanation and adds a Semantic Summary column between Deterministic Summary and Suggested Next Step. Semantic Summary is derived client-side from the existing semantic comparison payload, prioritizing conflicts, concerns, missing semantic evidence, and then supporting semantic factors without adding another AI call. Semantic Summary now prefers the semantic assessment explanation when available so the row can mention patient-specific evidence or missing patient data rather than only restating the trial criterion. Semantic Summary, Suggested Next Step, and Explanation cells use capped previews with "View full ..." actions for longer content to prevent row overflow. The Suggested Next Step column labels `Needs Review` patients as "Confirm Details" instead of "Request Confirmation" and displays generated suggested next steps under the primary action. Existing saved rows with the old primary-action label are normalized to "Confirm Details" in the Flutter UI. The Explanation and Recommendation Agent prompt now asks for a shorter clinical rationale that avoids repeating the visible score, status, and suggested next-step fields unless clinically necessary.
- Clinical trial status can now be updated from the trial detail page after a trial is created. The detail summary keeps Start Date, End Date, and Status on the same visually aligned row; Status is a subdued dropdown-style control that opens context-aware actions when clicked: Under Review trials can be activated or rejected, Ongoing trials can be completed or rejected, and terminal Completed/Rejected trials do not show follow-up actions. A plain-language status explanation remains visible below the date/status row instead of depending on hover text. The backend keeps storing `clinical_trials.trial_status` as numeric values (`0` Under Review, `1` Ongoing, `2` Completed, `3` Rejected) and exposes a small update endpoint for the detail page.
- BMI exclusion wording is now displayed as an allowed range instead of a raw exclusion range. The create-trial form labels the inputs as Min/Max Allowed BMI, trial detail shows "Allowed BMI Range" plus a plain-language meaning, and legacy matched-patient descriptions display "Allowed BMI Range: X to Y" with a note that patients are excluded only below the minimum or above the maximum. The underlying `bmiRange` field and old deterministic BMI matching logic are unchanged.
- The trial detail "Detailed Information" table now labels inclusion rows as `Inclusion Criteria - ...` to match the existing exclusion-row style, folds the BMI meaning into the allowed BMI range value, standardizes general empty/not-applicable detail values as "Not Applicable", and shows blank exclusion fields as muted italic empty-state text such as "No exclusion criteria specified" instead of leaving details empty.
- The trial detail "Detailed Information" table now includes a final clickable row for "Additional Trial / Criteria Information Not Captured by the Base Form". It opens the saved supplemental/semantic criteria in a dialog, including source, summary, additional criteria, importance labels, and uploaded-document extraction notes when applicable, with an empty-state message when no supplemental information was saved. Manual-entry dialogs show the manually typed additional trial/criteria text with a "User provided" chip instead of a High/Medium/Low importance chip, suppress document-extraction notes because no document extraction occurred, and vertically center criteria text beside the chip for both manual and uploaded-document criteria rows. The row action is left-aligned with other detail values.
- The old matched-patient popup now separates trial medication exclusions from patient medications correctly. Trial-side medication exclusions stay under Exclusion Criteria, patient-side `prior_medication` now displays as "Current Medications", and the Flutter description parser recognizes both old and new labels so medication lines no longer fall into duplicate "Other Details" rows.
- The create-trial supplemental criteria panel now treats `missingOrAmbiguousCriteria` as secondary extraction context instead of another visible criterion row. Those notes are renamed to "Additional Extraction Notes", collapsed by default, and described as optional context about unclear document details while field-level "Needs review" indicators remain the primary required review mechanism. The notes section remains visible with an empty-state message when the extractor returns no missing/ambiguous notes, so reviewers can consistently see where that information would appear.
- After a clinical trial is created successfully, the Flutter create-trial flow now opens the new trial's detail page directly instead of returning to the trial list first.

## 2026-07-09

### Changed

- Hardened the clinical trial document upload/extraction path for PDF, DOCX, JSON, TXT, and MD. The backend now validates documents before calling the agents, accepts minified ClinicalTrials.gov JSON exports, rejects invalid JSON with a clear error, detects unreadable/scanned PDFs and empty text uploads, rejects readable non-trial documents, and reduces very large documents to relevant trial sections before extraction.
- JSON/TXT/MD uploads now detect UTF-8, UTF-8 BOM, UTF-16 LE BOM, and UTF-16 BE BOM encodings, so Windows-formatted UTF-16 JSON exports can still be parsed.
- Multi-location trial uploads now preserve comma-separated state/province/region values followed by country when multiple regions are present in one country, and the Flutter form places country-only extraction output in the Country field instead of Region/State.
- The create-trial upload progress dialog now settles into an explicit success or failed state before closing, while the page still shows the final success/error message.
- The create-trial file picker no longer treats a quick browser focus event as a cancelled selection, preventing real file selections from being swallowed before the progress tracker appears.
- Create-trial dropdowns now constrain long selected values with ellipsis and normalize common extracted enum variants such as `PHASE2`, `INTERVENTIONAL`, `RANDOMIZED`, and detailed masking strings into the app's known dropdown values.
- Create-trial required-field validation now stays visible after extraction/submit even when fields scroll out of view and rebuild.
- The create-trial top review notice now includes locally empty required fields, including Contact Information fields that the document extractor does not fill.
- The create-trial Trial ID field now autofills from a backend-generated next database ID in four-digit padded UI format (`0001`, `0002`, etc.), remains editable, checks for duplicate IDs on field completion and submit, and no longer gets overwritten by the uploaded document's NCT/protocol ID. The database still stores `clinical_trials.trial_id` as an integer; Flutter applies the padding for display.
- The document upload progress label now says "Extracting trial fields" without naming the extraction provider.
- The create-trial sidebar no longer repeats the lower eHospital logo/workspace branding block, so the navigation groups sit higher while keeping the existing items, icons, active state, and disabled "Soon" labels.
- The clinical trial document extractor now returns participant/investigator masking details, and the Flutter create-trial form automatically checks "Mask Participant" and "Mask Investigator" when the uploaded document supports those values. The checkboxes remain editable.
- The create-trial Pathology, Diseases, Surgeries, and Medication Exclusions controls are now editable autocomplete text fields instead of fixed dropdown-only fields; the internal `pathology` field is labeled "Primary Pathology / Target Condition" in the UI and no longer defaults to Hypertension. Related Conditions also uses editable autocomplete text entry while preserving its string payload. Multi-value clinical fields show shorter comma guidance that can wrap instead of clipping, and long comma-separated fields such as Region/State, Related Conditions, Primary Pathology / Target Condition, Diseases, Surgeries, and Medication Exclusions can open a larger View/Edit dialog without changing the stored string payload. Uploaded documents preserve multiple extracted values in comma-separated form, multi-state uploads preserve comma-separated Region/State values, Pregnancy is labeled as a pregnancy exclusion, and Trial Phase/Allocation/Intervention Model include additional common design values.
- The POC ranked-matching pipeline now treats comma-separated/free-text clinical fields as semantic clinical context instead of exact deterministic string-match rules. `related_conditions`, `pathology`, disease exclusions, surgery exclusions, and Medication Exclusions (`priorMedications`/`PriorMedications`) remain stored/displayed in the existing API/database shape, but semantic comparison now receives those trial fields alongside patient diagnosis/pathology, diagnosis classifications, medications, surgeries, medical history, and notes. Deterministic matching is narrowed to objective fields that line up cleanly between trial and patient records: gender, age, BMI, and pregnancy.
- Ranked matching now treats absence of the trial target condition/pathology as a high-severity semantic conflict rather than a supporting factor or mild missing-data issue, and eligibility scoring applies extra penalties for high-severity semantic conflicts plus a stronger target-condition-absence penalty so objective-field matches cannot float clinically mismatched patients to the top of the ranked dashboard. Scoring also downgrades uncertain threshold-based conflicts (for example "eGFR not provided" or "HbA1c missing") from confirmed high conflicts to medium scoring weight while preserving the reviewer-facing note, so missing lab proof triggers review without counting as a confirmed failed lab.
- Ranked matching scoring was updated again on July 10 to the v3 weighted clinical model. The Semantic Patient-Trial Comparison Agent now returns per-criterion `criteriaAssessments`, and the Eligibility Scoring Agent scores non-hard-excluded patients using fixed buckets: Objective eligibility 25%, Core clinical fit 35%, Clinical exclusion safety 25%, and Additional trial / criteria fit 15%. Hard deterministic exclusions still cap the score in the 0-25 Not Eligible band, and High-severity semantic conflicts still force Needs Review. Legacy semantic outputs without `criteriaAssessments` use a coarse fallback assessment so older debug paths do not crash.
- The ranked dashboard now has a "Refresh Saved Results" action that recomputes the already-displayed saved patient rows and overwrites their stored scores/explanations. "Run Next Batch" still processes only patients without saved ranked results.
- The shared app header now enlarges the top-left eHospital logo wherever it appears, without increasing the adjacent eHospital text or page title.
- The document extraction progress dialog keeps the main "Extracting Trial Fields" heading but hides the smaller duplicate "Extracting trial fields" detail line during that step.
- Returning to the Trial List after deleting a trial now automatically refreshes the table so the deleted trial disappears immediately, while the manual refresh button remains available.
- The create-trial form now shows a visible `*` on fields that already participate in required-field validation. After document extraction, fields flagged as needing review get amber field-level highlighting, a warning icon, and a "Mark reviewed" action; trial creation is blocked until all pending review flags are acknowledged. The top extracted-field review notice keeps each category label on the same line as its field list.
- The additional extracted-information panel at the bottom of the create-trial form is now titled "Additional Trial / Criteria Information Not Captured by the Base Form", no longer shows implementation/storage copy, and includes "Importance" plus "Extracted Criteria / Notes" headers above the extracted rows.
- The Supplemental Criteria Interpretation Agent now has stricter relevance guidance for uploaded-document additional criteria: High is reserved for criteria that likely determine eligibility directly, Medium is for clinically useful context that may need reviewer judgment, and Low is for weak supporting or operational context. This makes the uploaded-document importance chip more meaningful without changing the semantic matching payload shape.
- Manually entered trials now save a `clinical_trial_semantic_criteria` row with `source_type = manual_form` so the ranked matching pipeline can use manual trials too. Uploaded trials continue to use the supplemental criteria extracted during document upload.

### Added

- Parser-level validation script: from `backend_copy`, run `npm run validate:document-upload` to check valid ClinicalTrials.gov JSON, invalid JSON, non-trial JSON, and empty text handling without making OpenAI calls.
- `POST /api/users/getNextClinicalTrialId` to suggest the next editable internal Trial ID for the create-trial form; as corrected on 2026-07-10, the backend uses the small internal row sequence plus `clinical_trial_id_history` so deleted/previously used Trial IDs are skipped while the frontend displays small IDs with four digits and the API/database remain numeric.
- `POST /api/clinical-trial-poc/extract-manual-supplemental-criteria` to run the Supplemental Criteria Interpretation Agent on manually typed additional criteria and structured create-trial fields before saving semantic criteria for a manually entered trial.

## 2026-07-06 (Task 10 + Ranked Dashboard)

### Added

- Explanation and Recommendation Agent (Task 10): `explanationAgent.js` explains an already-computed score/status in 2-4 sentences and suggests 1-3 concrete next steps, using the deterministic detail and semantic comparison detail as grounding - explicitly told not to recompute the score or state a final medical/enrollment decision. Unlike scoring, this one *is* an OpenAI call, since fluent explanation is generation work. `explanationService.js` runs it once per patient, sequentially, and separately derives a `primaryAction` ("Invite Patient"/"Request Confirmation"/"Do Not Invite") deterministically from `status` so the dashboard's action button is always one of a small, consistent set rather than left to the model.
- `POST /api/clinical-trial-poc/explain-recommend` and `POST /api/clinical-trial-poc/ranked-patients` - the latter is the real production endpoint, chaining all of Tasks 7-10 for every patient against a trial (no debug patient-count cap) and ranking by score. Nothing is persisted yet (Task 12).
- **Ranked Patient Match Dashboard** (Task 11): the trial detail page's "Match Runner" section is now a full ranked dashboard - Rank, Patient, Match Score (colored dot + progress bar), Match Status (colored pill), Deterministic Match Summary (readable bullet sentences derived from matched/failed/missing fields), Explanation (with a "view full" dialog), and Suggested Next Step (colored action button + guidance caption), plus a color legend. Colors are a 3-way bucket (green = Strong/Likely Match, amber = Needs Review, red = Weak Match/Not Eligible) shared by the score dot, status pill, and action button for one consistent visual language.
- `ApiService.getRankedPatients(trialId)` to call the new endpoint from Flutter.
- Ranked result persistence: `POST /api/clinical-trial-poc/ranked-patients` now saves generated dashboard rows to `clinical_trial_match_results`, and `GET /api/clinical-trial-poc/ranked-patients/:trialId` reloads saved rows without rerunning AI calls. The Flutter detail page reads these saved rows on load, so ranked dashboards persist after refresh/restart.
- Ranked matching batch selection: the trial detail page now prompts for the next 10, next 20, or all remaining patients without saved ranked results, then shows a modal progress indicator while the selected batch runs. The dialog suppresses redundant choices, e.g. when only 10 remain it shows only "All remaining (10)".
- Legacy-trial guard: "Run Matching" now checks for saved supplemental criteria first and explains that legacy/manual trials must be re-input through the document pipeline before a ranked list can be produced.
- POC trial deletion: trial detail pages now include a delete action that removes the trial plus saved semantic criteria, ranked result rows, patient links, contacts, and trial actions so the same study can be re-tested.

### Notes

- The dashboard's "Deterministic Match Summary" bullets are generated client-side from field *names* (e.g. "Age matches trial criteria") rather than the exact numeric values (e.g. "Age 52 is within required range") shown in the original mockup, since `deterministicMatchingService.js` doesn't currently carry patient-specific values through its structured output. Adding that would mean changing an already-shipped, tested response shape (Task 7) - left as a future enhancement rather than done as part of this pass.
- "Run Matching" on a selected batch makes two sequential OpenAI calls per patient (semantic comparison, then explanation) - expect it to take a while for larger batches. The current progress dialog is frontend-estimated because there is no background-job/progress-polling mechanism yet. Stored rows prevent rerunning already-ranked patients unless the trial is deleted/recreated or a future refresh/stale-result flow is added.

### Fixed

- Fixed deterministic disease hard exclusions that could be missed because patient pathology classifications were lowercased while trial disease exclusions were compared with original casing. Historical note: this was later superseded in the POC ranked-matching pipeline on 2026-07-09 when disease exclusions moved from deterministic exact matching to semantic comparison.

## 2026-07-06 (v2)

### Changed

- Reworked the Eligibility Scoring Agent formula after review surfaced three real problems (see `DECISIONS.md` for full reasoning):
  - Hard exclusions used to flatten to a single score of 5; now banded into `[0, 25]` scaled by how well the patient otherwise matched, so ranking still works within strict trials where many patients trip an exclusion. Status stays unconditionally "Not Eligible" for this band either way.
  - Semantic penalties/bonuses used to be flat per-item point deltas, which scaled with how many supplemental criteria a trial happened to have, biasing well-documented trials. Now ratio-normalized against that trial's `totalSupplementalCriteriaCount`.
  - The Semantic Comparison Agent's `potentialConflicts`/`concerns` now carry a `severity` (`High`/`Medium`/`Low`) rating instead of being bare strings, so a trivial detail and a likely-disqualifying one no longer cost the same.
  - The final composite score passes through a `tanh` compression so 0 and 100 become asymptotic rather than trivially reachable.
  - Any `High`-severity conflict now unconditionally forces "Needs Review" status regardless of score tier, rather than only downgrading a Strong/Likely reading - a serious flag means "a human needs to look at this," not "this is generally a weak match."
- `scoreBreakdown` now includes `rawScoreBeforeCurve` so the curve compression itself is auditable, not an opaque final jump between the linear composite and the displayed score.
- `POST /api/clinical-trial-poc/score-eligibility` now takes `totalSupplementalCriteriaCount` in its request body; `semantic-compare`'s response now also returns it at the top level so callers don't need a second lookup.

## 2026-07-06

### Added

- Eligibility Scoring Agent (Task 9): `eligibilityScoringService.js` combines a patient's `deterministicResult` and `semanticComparison` into a score (0-100) and status. Deliberately a plain formula rather than an OpenAI call, since it only combines outputs the earlier agents already computed - keeps the score auditable instead of another opaque model output.
- Hard-exclusion ceiling: any `hardExclusionFlags` from deterministic matching forces the score to 5 and status to "Not Eligible" regardless of semantic input - semantic support can never override a hard exclusion, per the project's core safety principle.
- "Needs Review" downgrade: a score that would otherwise read Strong/Likely Match is capped at "Needs Review" when there are unresolved gaps - missing deterministic fields, semantic conflicts, 3+ pieces of missing semantic information, or semantic comparison being unavailable/errored entirely. Caught and fixed during testing: a fully-failed semantic comparison was initially still producing "Likely Match" instead of being flagged.
- `POST /api/clinical-trial-poc/score-eligibility` (`{ patients: [{ patientId, deterministicResult, semanticComparison }] }`), matching the original API_CONTRACT draft shape since this step's inputs are already-computed data, not something to re-fetch from the database.
- `GET /api/clinical-trial-poc/full-match-debug/:trialId` chains deterministic matching + semantic comparison + scoring for one-URL end-to-end smoke testing of the pipeline so far. Same real-OpenAI-call/2-patient-default caveats as the semantic-compare debug route.

## 2026-07-05 (yet later)

### Added

- Semantic Patient-Trial Comparison Agent (Task 8): `semanticComparisonAgent.js` compares one patient at a time against a trial's saved supplemental criteria (`patients_pathology.medical_history`/`other_notes` plus diagnosis/medications/surgeries), explicitly without producing a score or recommendation. `semanticComparisonService.js` orchestrates loading the trial's saved semantic criteria and patient context, then calls the agent sequentially per patient (per the sequential-calls decision), degrading gracefully per-patient on failure. Historical note: as of 2026-07-09, this context also includes multi-value clinical form fields and diagnosis classifications.
- `POST /api/clinical-trial-poc/semantic-compare` (`{ trialId, patientIds? }`), following the same trialId-based pattern as `deterministic-match` rather than the API_CONTRACT draft's raw-payload shape. Not yet wired into the Match Runner UI - that happens once Tasks 9-10 exist and an orchestrator chains 7-10 together.

## 2026-07-05 (even later)

### Added

- "Match Runner" section on the clinical trial detail page: a status line plus a "Run Matching" / "Refresh Matching" button, calling the existing structured `deterministic-match` endpoint on demand. Deliberately not triggered automatically by trial creation (per the existing incremental-matching decision) and clearly labeled as showing only the deterministic step so far, with semantic comparison/scoring/explanation still to come. First UI step toward Task 11.
- `ApiService.getDeterministicMatch(trialId)` to call the endpoint from Flutter.

### Notes

- Clarified that the pre-existing "Matched Patients" table further down the same trial detail page is unrelated legacy e-Hospital functionality (live, unstored, boolean pass/fail deterministic matching from before this project started), not part of the new AI pipeline. Kept as-is, left visually below the new Match Runner section.

## 2026-07-05 (later)

### Added

- Supplemental Criteria Interpretation Agent: extracts medically relevant trial criteria not covered by the hardcoded form fields, running against the same uploaded document as the Clinical Trial Document Field Extractor so there is only one upload/parse per document.
- `POST /api/clinical-trial-poc/save-semantic-criteria` to persist the supplemental criteria preview into `clinical_trial_semantic_criteria` once a trial is actually created.
- Flutter create-trial form now shows a review panel with the structured fields going into the form and the supplemental semantic criteria going into `clinical_trial_semantic_criteria`, separately labeled.
- `POST /api/clinical-trial-poc/deterministic-match`: a structured, per-field version of the existing deterministic matching rules (matched/failed/missing fields, hard exclusion flags) as groundwork for the future Eligibility Scoring Agent. Implemented in an isolated `deterministicMatchingService.js`; does not change existing matched-patient endpoints in `userController.js`.
- `GET /api/clinical-trial-poc/semantic-criteria/:trialId` to read back a saved semantic criteria row, for smoke-test verification and as a preview of the future Supplemental Criteria review screen's read path.
- A debug-only "Fill Test Data" button on the create-trial form (visible only in `kDebugMode`/`flutter run`, compiled out of release builds) that backfills empty required fields with placeholder values, to speed up manual smoke testing of the upload -> create trial -> save semantic criteria flow.

### Changed

- Added a `UNIQUE` constraint on `clinical_trial_semantic_criteria.trial_id` in the local-dev schema to support upserting one semantic criteria row per trial.
- Moved the supplemental semantic criteria review panel to the bottom of the create-trial form, below Exclusion Criteria, per manual testing feedback.

### Fixed

- Removed a redundant "Structured Fields Going Into This Form" preview panel: it duplicated values already shown in the editable form fields (the field extractor already autofills those controllers directly) and rendered with broken (oversized, red, underlined) text because its `RichText` used a raw `DefaultTextStyle.of(context).style` instead of a themed text style.
- Fixed a smoke-testing blocker where an extracted `trialId` containing letters/dashes (e.g. a real protocol ID like `MLS-101-202`) failed the create-trial form's "must be a number" validation, since `clinical_trials.trial_id` is an `INT` column. Historical note: this was later superseded on 2026-07-09 by database-backed Trial ID autofill, so uploaded document IDs no longer overwrite the form's internal Trial ID. The debug "Fill Test Data" button also now overwrites an invalid (non-numeric) `trialId`, not just an empty one.
- Fixed the same issue at the source: the Clinical Trial Document Field Extractor's prompt now explicitly tells the model `trialId` must be digits only, and `fieldExtractorAgent.js` also normalizes server-side (extracting the digits-only portion and flagging `trialId` for review) as a safety net in case the model doesn't comply. Historical note: as of 2026-07-09, the Flutter form keeps its database-backed Trial ID separate from any uploaded document ID.
- Audited every extracted field against its actual database/matching-logic type constraint and added two more server-side normalizers to `fieldExtractorAgent.js`: `normalizeDate` (coerces `startDate`/`endDate` to `YYYY-MM-DD` or null, preventing a downstream `new Date(...).toISOString()` crash on an unparseable date) and `normalizeEnum` (snaps `gender`/`pregnancy` to their exact allowed casing or nulls them out, since both feed exact-string-equality checks in deterministic matching). All three normalized fields (`trialId`, dates, enums) get flagged in `fieldsNeedingReview` when a fallback fires. Free-text fields (names, summaries, descriptions, sponsor, etc.) needed no change since they map to `VARCHAR`/`TEXT` columns with no stricter type constraint.

## 2026-07-05

### Changed

- Expanded local synthetic database seed data to 20 patients and added NCT-inspired diabetes, hypertension, and rheumatoid arthritis test trials while preserving the copied backend table shapes.
- Added richer `patients_pathology.medical_history` and `patients_pathology.other_notes` seed content for future semantic patient-trial comparison.
- Added local POC storage for supplemental trial criteria and generated trial-patient match results.
- Refactored the clinical trial field extractor into an isolated backend agent service without changing the upload endpoint contract.
- Removed the hypertension and rheumatoid arthritis NCT-inspired trials from local seed data so they can be used as clean extractor/matching test cases.

## 2026-07-04

### Added

- First version of the Clinical Trial Document Field Extractor: Flutter upload from the create trial form, backend PDF/DOCX/TXT text extraction, server-side OpenAI field mapping, and review-only autofill without automatic trial creation.

### Changed

- Moved the create-trial document upload control into the top action area, fixed cancel-state loading behavior, and added Markdown (`.md`) as a supported text-style upload format.

## 2026-07-03

### Added

- Shareable local MySQL development kit under `backend_copy/local-dev/`.
- Synthetic seed data for patients, doctors, clinical trials, pathology classifications, and clinical trial actions.
- Safe example backend config files for local MySQL and placeholder MongoDB setup.

## 2026-07-02

### Fixed

- Flutter matched patient detailed descriptions now display `BMI Range` under Exclusion Criteria instead of Inclusion Criteria, matching the create trial form structure.

## 2026-06-30

### Added

- Initial project context documentation.
- Project brief for the agentic clinical trial matching POC.
- Working guide and conventions for contributors.
- Draft architecture document.
- Draft API contract.
- Backend reintegration tracking document.
- Initial task list.
- Standalone clinical trial Flutter frontend added under `flutter_frontend/`.

### Changed

- N/A

### Fixed

- N/A

### Notes

- The backend will use a copied version of the existing e-Hospital backend.
- Backend changes must be tracked in `BACKEND_CHANGES.md`.
- The Flutter frontend now exists under `flutter_frontend/`; future agentic AI pages remain planned work.
