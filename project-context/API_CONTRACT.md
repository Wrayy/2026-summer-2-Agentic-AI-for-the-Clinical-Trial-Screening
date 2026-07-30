# API Contract

## Purpose

This file defines the expected communication between the Flutter frontend and the backend.

The API contract should be updated whenever request fields, response fields, endpoint names, or data formats change.

This is a working draft and may change as implementation progresses.

## Response Conventions

Unless otherwise noted, backend responses should use a consistent structure:

```json
{
  "status": "OK",
  "result": {}
}
```

For errors:

```json
{
  "success": false,
  "status": "ERROR",
  "errorCode": "MACHINE_READABLE_ERROR_CODE",
  "message": "Human-readable error message"
}
```

## POST /api/users/login

### Purpose

Authenticate the standalone Flutter app through the original e-Hospital pharmaceutical-company login path.

The frontend sends the same request shape as the copied backend's existing `Pharma` branch and labels the UI as "Pharmaceutical Office". This endpoint is not a new auth system; it preserves the original `/api/users/login` behavior for the POC.

### Request

```json
{
  "email": "pharm1@test.com",
  "password": "pharm1",
  "selectedOption": "Pharma"
}
```

`selectedOption` must be `"Pharma"` for the standalone clinical-trial app.

### Response

On success, the inherited backend returns the pharmaceutical company database row. The Flutter app consumes only the company identity fields:

```json
{
  "id": 1,
  "name": "Standalone Pharma",
  "email": "pharm1@test.com"
}
```

The legacy response may include additional database fields. The frontend must not store the submitted password and stores only `{ "type": "Pharma", "id": number, "name": string, "email": string }` in browser session or local storage depending on the Remember Me choice.

Invalid credentials return the copied backend's existing error behavior:

```json
"wrong credentials"
```

with HTTP status `400`.

## POST /api/clinical-trial-poc/extract-trial-fields

### Purpose

Extract structured clinical trial fields from an uploaded PDF, DOCX, JSON, TXT, or MD document.

This endpoint supports the Clinical Trial Document Field Extractor.

This endpoint uses server-side LLM extraction through OpenAI when `OPENAI_API_KEY` is configured in `backend_copy/.env`. The OpenAI key must never be sent from Flutter or stored in client-side code.

### Request

Multipart form data:

```json
{
  "file": "PDF_DOCX_JSON_TXT_OR_MD_FILE"
}
```

Supported file types:

- PDF
- DOCX
- JSON
- TXT
- MD

The backend validates and prepares documents before calling the OpenAI agents:

- JSON must parse successfully. ClinicalTrials.gov JSON exports under `protocolSection` are accepted even when minified/unpretty; the backend extracts only the relevant trial sections before sending text to the agents. UTF-8, UTF-8 BOM, UTF-16 LE BOM, and UTF-16 BE BOM text encodings are supported for JSON/TXT/MD uploads.
- PDF and DOCX files must yield readable text from the server-side parser. Scanned/image-only PDFs without selectable text return a clear read/no-text error unless OCR is added later.
- TXT and MD files must contain readable clinical-trial text.
- Very large documents are reduced to relevant trial sections such as title, summary, description, condition, eligibility, inclusion/exclusion, intervention, arms, outcomes, phase, design, enrollment, sponsor, contacts, and locations before agent extraction.
- Documents with readable text but no clinical-trial signals return a clear "could not find clinical trial fields" error instead of calling the agents.
- For ClinicalTrials.gov JSON with multiple locations, the extractor input includes state/province/region values plus country for form autofill. When multiple regions exist in one country, the upload flow preserves those regions as comma-separated Region/State text followed by the Country value; country-only extraction output is still treated as `country`, not `region`.

### Response

```json
{
  "status": "OK",
  "result": {
    "extractedFields": {
      "trialName": "string or null",
      "trialId": "string or null, digits only when extracted from a source document; the Flutter create-trial form uses /api/users/getNextClinicalTrialId for its editable internal database Trial ID instead of overwriting it with the document's NCT/protocol ID",
      "officialTitle": "string or null",
      "location": "string or null",
      "briefSummary": "string or null",
      "detailedDescription": "string or null",
      "startDate": "YYYY-MM-DD or null",
      "endDate": "YYYY-MM-DD or null",
      "sponsor": "string or null",
      "principalInvestigator": "string or null",
      "ethicsApproval": "string or null",
      "primaryPurpose": "string or null",
      "trialPhase": "string or null",
      "studyType": "string or null",
      "allocation": "string or null",
      "interventionModel": "string or null",
      "masking": "string or null",
      "maskingDetails": {
        "participant": "boolean or null",
        "investigator": "boolean or null"
      },
      "relatedConditions": "string or null",
      "pathology": "string or null",
      "gender": "Male | Female | Both | null",
      "ageRange": "string or object or null",
      "bmiRange": "string or null",
      "diseases": "string or null",
      "surgeries": "string or null",
      "priorMedications": "string or null",
      "pregnancy": "Yes | No | Unrestricted | null"
    },
    "missingRequiredFields": ["fieldName"],
    "fieldsNeedingReview": ["fieldName"],
    "confidence": {
      "overall": "number between 0 and 1 or null",
      "fieldNotes": [
        {
          "field": "string",
          "confidence": "number between 0 and 1 or null",
          "sourceNote": "string or null",
          "needsReview": true
        }
      ]
    },
    "source": {
      "filename": "string",
      "mimeType": "string",
      "fileKind": "pdf | docx | json | txt | md",
      "originalTextCharacters": 2345,
      "extractedTextCharacters": 1234,
      "wasReduced": true,
      "documentFingerprint": "16-character diagnostic SHA-256 prefix",
      "preprocessingVersion": "document-preprocessing-v2",
      "extractor": "openai",
      "model": "gpt-4.1-mini",
      "fieldExtractorVersion": "field-extractor-prompt-v2",
      "fieldExtractorSchemaVersion": "field-extractor-schema-v2",
      "responseFormat": "json_schema or json_object",
      "seed": "number or null",
      "systemFingerprint": "string or null"
    },
    "supplementalCriteria": {
      "additionalTrialInformation": [
        {
          "category": "string",
          "criterion": "string",
          "sourceText": "string or null",
          "relevance": "High | Medium | Low",
          "notes": "string or null",
          "origin": "optional backward-compatible metadata such as user_added",
          "userEdited": "optional boolean metadata"
        }
      ],
      "summary": "string",
      "missingOrAmbiguousCriteria": ["string"],
      "source": {
        "filename": "string",
        "mimeType": "string",
        "extractedTextCharacters": 1234,
        "documentFingerprint": "16-character diagnostic SHA-256 prefix",
        "preprocessingVersion": "document-preprocessing-v2",
        "extractor": "openai",
        "model": "gpt-4.1-mini",
        "supplementalExtractorVersion": "supplemental-extractor-prompt-v2",
        "supplementalExtractorSchemaVersion": "supplemental-extractor-schema-v2",
        "responseFormat": "json_schema or json_object",
        "seed": "number or null",
        "systemFingerprint": "string or null"
      },
      "error": "string, only present if the supplemental agent call failed"
    },
    "extractionMetadata": {
      "freshExtraction": true,
      "documentFingerprint": "16-character diagnostic SHA-256 prefix",
      "preprocessingVersion": "document-preprocessing-v2",
      "fieldExtractorVersion": "field-extractor-prompt-v2",
      "fieldExtractorSchemaVersion": "field-extractor-schema-v2",
      "supplementalExtractorVersion": "supplemental-extractor-prompt-v2",
      "supplementalExtractorSchemaVersion": "supplemental-extractor-schema-v2",
      "model": "gpt-4.1-mini",
      "fieldSystemFingerprint": "string or null",
      "supplementalSystemFingerprint": "string or null",
      "agentsFreshlyExecuted": {
        "fieldExtractor": true,
        "supplementalCriteria": true
      }
    }
  }
}
```

`maskingDetails.participant` and `maskingDetails.investigator` drive the create-trial form's "Mask Participant" and "Mask Investigator" checkboxes after upload. The extractor should set them only when supported by the document; the Flutter form still leaves both checkboxes editable for manual correction.

`relatedConditions`, `pathology`, `diseases`, `surgeries`, and `priorMedications` remain plain string fields in the API/database shape. The Flutter create-trial form renders them as editable autocomplete text fields instead of closed dropdowns where applicable, so extracted document wording can be preserved without changing the stored schema. The user-facing label for `pathology` is "Primary Pathology / Target Condition" because the ranked pipeline treats it as the main semantic target condition. The user-facing label for `priorMedications` is "Medication Exclusions"; the internal API/database keys stay `pathology` and `priorMedications`/`PriorMedications` for compatibility.

These clinical text fields may contain multiple comma-separated values. The extractor is instructed to return multiple supported values as comma-separated strings, and backend normalization also converts arrays, semicolon lists, and newline lists into comma-separated text. Because these multi-value clinical phrases often do not line up exactly with patient fields, the POC ranked-matching pipeline now treats `relatedConditions`, `pathology`, `diseases`, `surgeries`, and medication exclusions as **semantic clinical context**, not exact deterministic string-match criteria. They are saved/displayed on the trial form and then passed into semantic patient-trial comparison alongside patient diagnosis/pathology, diagnosis classifications, medications, surgeries, medical history, and other notes.

`priorMedications` is optional and should include only medications that would disqualify/exclude a patient. Medication requirements or medication stability criteria should be captured as semantic/supplemental criteria rather than stored in Medication Exclusions.

`location` remains a single string for the upload response. For multi-location trials in one country, the extractor should return comma-separated state/province/region values followed by the country, so Flutter can put all leading values into Region/State and the final value into Country.

The Flutter form keeps bounded dropdowns for `gender`, `pregnancy`, `trialPhase`, `studyType`, `allocation`, `interventionModel`, and `masking`, but the option lists now cover more common trial-design values. `pregnancy` is labeled in the UI as "Pregnancy Exclusion"; the submitted value remains `Yes`, `No`, or `Unrestricted`, where `Yes` means pregnancy is treated as an exclusion by deterministic matching.

The `bmiRange` field keeps the existing string payload format, such as `> 18 and < 40`, for compatibility with current backend matching. The Flutter UI presents this as an "Allowed BMI Range" and explains that patients are excluded only when their BMI is below the minimum or above the maximum.

Every upload performs a fresh parse, a fresh Clinical Trial Document Field Extractor call, and a fresh Supplemental Criteria Interpretation Agent call. The `documentFingerprint` and `extractionMetadata` values are diagnostic only and must never be used as a result cache or a reason to skip either agent. Extraction preprocessing normalizes line endings, supported encodings, repeated whitespace, ClinicalTrials.gov JSON module order, relevant-section selection, and truncation deterministically so identical content produces identical final agent input. The extraction agents use `temperature: 0`; for model names explicitly allow-listed by the backend, they use strict JSON Schema response format and the fixed configurable `OPENAI_EXTRACTION_SEED` value (default `424242`). Other models fall back to `json_object` without sending unsupported seed/schema parameters.

The Flutter upload dialog has a Cancel action. Cancel immediately closes the progress dialog, restores the form state from before that upload attempt, and ignores any late response from the cancelled request by extraction-request ID. No extracted fields, supplemental criteria, review labels, filename state, or success UI from a cancelled request may be applied or saved. The current backend/OpenAI request may still continue in the background because this POC does not yet propagate an abort signal through the multipart upload and OpenAI agent calls.

`supplementalCriteria` is produced by the Supplemental Criteria Interpretation Agent, which runs against the same freshly prepared uploaded document text right after field extraction (see `requiredFieldsForSupplementalAgent` in `clinicalTrialDocumentExtractorService.js`) so the document is only uploaded/parsed once. If the supplemental agent call fails, `extractedFields` and the rest of the response are still returned; `supplementalCriteria.error` is set and `additionalTrialInformation`/`summary`/`missingOrAmbiguousCriteria` are empty. No previous successful result is substituted.

In the Flutter create-trial review UI, `additionalTrialInformation` is shown as the main additional criteria table. `missingOrAmbiguousCriteria` is stored and submitted unchanged, but it is presented as collapsed "Additional Extraction Notes" because these entries are optional context about unclear source-document details, not separate matching rules and not the same thing as field-level "Needs review" flags. The "Additional Extraction Notes" section remains visible even when the list is empty, showing an empty-state message so reviewers know where those notes would appear.

For uploaded-document supplemental criteria, `relevance` is a reviewer-facing extraction importance label. The agent should reserve `High` for criteria that likely determine eligibility directly, such as explicit inclusion/exclusion rules, required treatment regimens, lab thresholds, timing windows, contraindications, or safety exclusions. `Medium` is for clinically useful context that may affect reviewer judgment but is not clearly disqualifying by itself. `Low` is for weak supporting context or operational nuance that is medically relevant but unlikely to change eligibility alone. This label is not the final scoring severity; scoring uses the Semantic Patient-Trial Comparison Agent's per-patient `potentialConflicts` and `concerns` severity ratings.

The supplemental agent evaluates a fixed checklist in this order: target-condition nuance, disease severity/stage, required medication/stability, prior treatment/failures, laboratory thresholds, organ function, recent hospitalization/acute events, surgery/procedure timing, comorbidities/contraindications, reproductive/contraceptive requirements, timing windows/washouts, functional/performance status, other explicit medical criteria, and clinically relevant missing/ambiguous information. Backend normalization canonicalizes category names, relevance values, whitespace, exact duplicates, and checklist ordering while preserving clinically distinct criteria.

This is preview-only, same as `extractedFields`: nothing is written to `clinical_trial_semantic_criteria` until the trial is actually created and the frontend calls `POST /api/clinical-trial-poc/save-semantic-criteria` below. The Flutter form may add `origin: "user_added"` or `userEdited: true` metadata to individual criteria when users add or edit supplemental criteria; consumers must ignore unknown metadata and read the current `criterion`, `category`, `relevance`, `sourceText`, and `notes` values.

Manual create-trial entries use the same semantic-criteria persistence path, but the Flutter form still preserves the exact text from the optional full-width bottom section titled "Additional Trial / Criteria Information Not Captured by the Base Form" as manual criteria when provided, while also allowing structured user-added/user-edited criteria through the shared editor. Manual rows use `sourceType = "manual_form"`. This keeps base form fields such as age, gender, and BMI from being reinterpreted as additional criteria in the detail dialog. Manual text and structured user-added criteria remain included in semantic matching. The field is submitted through the stable internal `additionalCriteriaInformation` key and is the natural-language source for extra manual eligibility criteria so `detailedDescription` can remain a general trial overview.

### Error Cases

Unsupported file types return:

```json
{
  "success": false,
  "status": "ERROR",
  "errorCode": "UNSUPPORTED_DOCUMENT_FORMAT",
  "message": "Unsupported document format. Upload a PDF, DOCX, JSON, TXT, or MD file."
}
```

Other document-preparation errors return the same shape with an `errorCode`, for example:

- `INVALID_JSON`
- `JSON_EMPTY`
- `PDF_PARSE_FAILED`
- `PDF_NO_READABLE_TEXT`
- `DOCX_PARSE_FAILED`
- `DOCUMENT_NO_READABLE_TEXT`
- `CLINICAL_TRIAL_FIELDS_NOT_FOUND`

If `OPENAI_API_KEY` is not configured, the backend returns a clear error and does not attempt client-side extraction.

## POST /api/users/getNextClinicalTrialId

### Purpose

Return the next editable internal `clinical_trials.trial_id` for the create-trial form.

The backend keeps this minimal with a single-row `clinical_trial_id_sequence` table. The suggested ID comes from the persistent `next_trial_id` counter, skips currently used `clinical_trials.trial_id` values, and advances after successful trial creation. This prevents deleted TrialIDs from being suggested again without storing a full TrialID history table. The sequence initializes from small local TrialIDs only, so large seeded/NCT-style numeric trial IDs do not push the editable UI sequence upward.

The Flutter form autofills this value on screen load using a four-digit display format for small numeric IDs (`0001`, `0002`, `0003`, etc.). The backend still returns and stores the numeric `clinical_trials.trial_id`; the padding is applied in the Flutter UI/display layer so existing integer relationships remain intact. The user can still edit the field, but the chosen value must contain digits only and must be unused. Leading zeroes are accepted by frontend/backend validation and compare against the same numeric stored value, so `0001` and `1` both refer to trial ID `1`.

### Request

```json
{}
```

### Response

```json
{
  "status": "OK",
  "result": 42
}
```

## POST /api/users/checkExistingClinicalTrialsId

### Purpose

Check whether a chosen editable Trial ID is already used by another clinical trial before saving.

The create-trial form calls this when the Trial ID field is completed and again before submit. If the ID is already present in `clinical_trials`, or if it is lower than the persisted `clinical_trial_id_sequence.next_trial_id`, the field shows `Trial ID already exists` and submission is blocked. The backend validates the same digits-only format and checks uniqueness against numeric `clinical_trials.trial_id`, so padded values are not treated as separate IDs.

### Request

```json
{
  "trialId": "42"
}
```

### Response

```json
{
  "status": "OK",
  "result": false
}
```

## POST /api/users/updateClinicalTrialStatus

### Purpose

Update the workflow status for an existing clinical trial after it has been created.

The database continues to store `clinical_trials.trial_status` as an integer:

- `0` = Under Review
- `1` = Ongoing
- `2` = Completed
- `3` = Rejected

The Flutter trial detail page uses this endpoint for context-aware status actions. Under Review trials can be activated or rejected; Ongoing trials can be completed or rejected; Completed and Rejected trials are treated as terminal in the current UI.

### Request

```json
{
  "trialId": "42",
  "status": 1
}
```

### Response

```json
{
  "status": "OK",
  "result": {
    "trialId": 42,
    "status": 1,
    "statusLabel": "Ongoing"
  }
}
```

Invalid trial IDs, invalid status values outside `0`-`3`, or missing trials return an error response.

## POST /api/clinical-trial-poc/extract-manual-supplemental-criteria

### Purpose

Run the Supplemental Criteria Interpretation Agent against manually typed additional criteria and structured create-trial fields when a caller explicitly needs agent interpretation for manual input. The current Flutter create-trial form does not call this endpoint for normal manual submissions; it saves the exact `additionalCriteriaInformation` text directly as `sourceType = "manual_form"` so the detail dialog mirrors what the user typed and does not show document-extraction notes for manual entries.

Agent failure should not roll back trial creation; it only means no supplemental criteria row is saved unless a future retry succeeds.

### Request

```json
{
  "formData": {
    "trialName": "string",
    "officialTitle": "string",
    "briefSummary": "string",
    "detailedDescription": "string",
    "additionalCriteriaInformation": "string",
    "relatedConditions": "comma-separated string",
    "pathology": "string",
    "ageRange": "string",
    "gender": "string",
    "bmi": "string",
    "diseases": "comma-separated string",
    "surgeries": "comma-separated string",
    "priorMedications": "comma-separated medication exclusions",
    "pregnancy": "string"
  }
}
```

### Response

```json
{
  "status": "OK",
  "result": {
    "additionalTrialInformation": [],
    "summary": "string",
    "missingOrAmbiguousCriteria": [],
    "source": {
      "filename": "manual-create-trial-form",
      "sourceType": "manual_form",
      "extractor": "openai",
      "model": "string"
    }
  }
}
```

## POST /api/clinical-trial-poc/save-semantic-criteria

### Purpose

Persist the Supplemental Criteria Interpretation Agent's preview output for a trial into `clinical_trial_semantic_criteria`, separately from `clinical_trials.exclusion_criteria`.

Called by the Flutter create-trial form immediately after `createClinicalTrial` succeeds, using the same editable internal `trialId` shown in the form. That field is prefilled by `POST /api/users/getNextClinicalTrialId` and can be edited as long as the chosen ID is not already used. One row is kept per `trial_id` (upserted).

### Request

```json
{
  "trialId": "string or number",
  "additionalTrialInformation": [
    {
      "category": "string",
      "criterion": "string",
      "sourceText": "string or null",
      "relevance": "High | Medium | Low",
      "notes": "string or null",
      "origin": "optional user_added metadata",
      "userEdited": "optional boolean metadata"
    }
  ],
  "summary": "string",
  "missingOrAmbiguousCriteria": ["string"],
  "sourceType": "supplemental_agent or manual_form"
}
```

### Response

```json
{
  "status": "OK",
  "result": {
    "trialId": "string or number",
    "sourceType": "supplemental_agent"
  }
}
```

## GET /api/clinical-trial-poc/semantic-criteria/:trialId

### Purpose

Read back the stored `clinical_trial_semantic_criteria` row for a trial. Primarily a debugging/verification tool for confirming that `save-semantic-criteria` actually persisted, and a preview of the read path the future "Supplemental Criteria" review screen will need.

The Flutter trial detail page uses this read path for the clickable "Additional Trial / Criteria Information Not Captured by the Base Form" row in the Detailed Information table. That dialog shows the saved `summary`, `source_type`, and `additionalTrialInformation`; it shows `missingOrAmbiguousCriteria` as extraction notes only for uploaded-document supplemental criteria, because manual entries do not come from document extraction. This display path does not change the matching payload.

### Response

```json
{
  "status": "OK",
  "result": {
    "id": 1,
    "trial_id": 5769608,
    "source_type": "supplemental_agent",
    "criteria_json": {
      "additionalTrialInformation": [],
      "missingOrAmbiguousCriteria": []
    },
    "summary": "string",
    "created_at": "datetime",
    "updated_at": "datetime"
  }
}
```

`result` is `null` if no row exists yet for that `trialId`.

## (Draft, not yet implemented) POST /api/clinical-trials/extract-supplemental-criteria

The original draft of this endpoint took raw `documentText` and `requiredFields` as a standalone call. The implemented POC instead folds this into `POST /api/clinical-trial-poc/extract-trial-fields` above (see `supplementalCriteria` in that response) so the trial document is only uploaded and parsed once. This section is kept only as a historical note; do not implement a separate endpoint for it unless a future need calls for extracting supplemental criteria without also running field extraction.

## POST /api/clinical-trial-poc/deterministic-match

### Purpose

Run deterministic matching for one trial against patients and return structured, per-field match detail instead of a single pass/fail boolean. This is the Task 7 "deterministic match output cleanup", implemented in isolation in `deterministicMatchingService.js` so the existing matched-patient endpoints in `userController.js` are untouched.

As of 2026-07-09, the POC ranked-matching pipeline intentionally narrows deterministic matching to objective fields that align cleanly between trial and patient records: gender/sex, age range, BMI range, and pregnancy exclusion. Multi-value/free-text clinical fields (`relatedConditions`, `pathology`, `diseases`, `surgeries`, and medication exclusions) are no longer exact deterministic checks in this POC pipeline; they are compared semantically because trial documents and patient records often use different wording for the same clinical concept.

The original draft of this endpoint took a full `trialCriteria` object in the request body. The implemented POC instead takes a `trialId` and reads the trial's own `pathology`, `gender`, `age_range`, and `exclusion_criteria` columns directly, since that criteria already lives in `clinical_trials` — the frontend does not need to resend it.

This endpoint is the structured deterministic foundation used by the ranked-matching pipeline through `deterministicMatchingService.js`. The Flutter app normally reaches it through the ranked-patients orchestrator rather than calling this endpoint directly.

### Request

```json
{
  "trialId": "string or number",
  "patientIds": ["optional list of patient IDs; defaults to all patients"]
}
```

### Response

```json
{
  "status": "OK",
  "result": {
    "trialId": "string or number",
    "patients": [
      {
        "patientId": "string or number",
        "patientName": "string",
        "deterministicResult": {
          "passed": true,
          "matchedFields": ["gender", "age", "bmi"],
          "failedFields": [],
          "missingFields": [],
          "hardExclusionFlags": [],
          "criteriaDetails": [
            {
              "field": "age",
              "criterion": "Required age range: 18-65",
              "patientData": "Age: 52",
              "outcome": "Matched"
            }
          ]
        }
      }
    ]
  }
}
```

`matchedFields` / `failedFields` cover deterministic criteria that were checked, currently gender, age, BMI, and pregnancy. `hardExclusionFlags` lists deterministic hard failures that actually triggered for those objective criteria. `missingFields` lists deterministic criteria that could not be evaluated because the patient record lacked the relevant data. `criteriaDetails` is an additive UI support array used by the Flutter dashboard's full deterministic summary dialog; scoring still uses the existing matched/failed/missing/hard-exclusion arrays. `passed` is `true` only when there are no deterministic `failedFields` and no deterministic `hardExclusionFlags`.

The legacy copied-backend matching paths in `userController.js` still use the older deterministic clinical string checks for existing screens. The POC ranked-matching pipeline uses `deterministicMatchingService.js`, where those clinical string checks have been removed in favor of semantic comparison.

Legacy matched-patient detail text should label the trial-side `priorMedications`/`PriorMedications` value as "Medication Exclusions" under Exclusion Criteria, but patient-side `patients_pathology.prior_medication` should be displayed as "Current Medications" under Patient Data. The old matching comparison still uses the same source fields: trial medication exclusions are compared against patient prior/current medication text, but the display labels should not imply that the patient has "medication exclusions."

## POST /api/clinical-trial-poc/semantic-compare

### Purpose

Compare a trial's saved semantic criteria and semantic clinical form fields against each patient's clinical context.

This endpoint supports the Semantic Patient-Trial Comparison Agent. It does not produce a score, match status, or recommendation - that is the Eligibility Scoring Agent's job (Task 9).

The original draft of this endpoint took the full `additionalTrialInformation` and per-patient `additionalPatientInformation` payload directly in the request body. The implemented POC instead takes a `trialId` (reading its saved `clinical_trial_semantic_criteria` row plus the trial's saved clinical form fields) and an optional `patientIds` list, matching the pattern used by `deterministic-match`, since that data already lives in the database. Calls OpenAI once per patient, sequentially (not batched/parallel).

The semantic trial context includes saved supplemental criteria plus the trial form's multi-value/free-text clinical fields: `related_conditions`, `pathology`, exclusion `Diseases`, exclusion `Surgeries`, and exclusion `PriorMedications`/`Prior Medications` (shown as Medication Exclusions). The semantic patient context includes `patients_pathology.pathology`, mapped diagnosis classifications from `pathology_classifications` when available, `prior_medication`, `surgeries`, `pregnancies`, `medical_history`, and `other_notes`. Age, gender, BMI, and pregnancy remain visible as deterministic/reference context but are not re-scored by the semantic agent.

Patient profile display is separate from matching input construction. The Flutter patient profile calculates BMI from structured `patients_registration.height` and `patients_registration.weight` and may filter known trial-aware/matching commentary from displayed `Other Notes` so the profile reads as patient information only. This includes hiding local demo phrases about excluded medications, trial fit, or intended match/non-match status. This does not mutate the database and does not change semantic comparison input, which still reads stored patient pathology/context fields.

The agent treats `Pathology / Target Condition` as required semantic target-condition evidence. If the patient record does not show that target condition or a clinically equivalent related condition, the agent should return a High-severity `potentialConflicts` item rather than counting the absence as support.

### Request

```json
{
  "trialId": "string or number",
  "patientIds": ["optional list of patient IDs; defaults to all patients"]
}
```

### Error Cases

If no `clinical_trial_semantic_criteria` row exists yet for the trial, returns a 400 error asking the caller to extract and save supplemental criteria first (`POST /save-semantic-criteria`) - there is nothing for this agent to compare against otherwise.

### Response

```json
{
  "status": "OK",
  "result": {
    "trialId": "string or number",
    "totalSupplementalCriteriaCount": 5,
    "patients": [
      {
        "patientId": "string or number",
        "patientName": "string",
        "semanticComparison": {
          "summary": "string",
          "supportingFactors": ["string"],
          "potentialConflicts": [
            { "description": "string", "severity": "High | Medium | Low" }
          ],
          "missingInformation": ["string"],
          "concerns": [
            { "description": "string", "severity": "High | Medium | Low" }
          ],
          "criteriaAssessments": [
            {
              "category": "string",
              "criterion": "string",
              "outcome": "Supported | Conflict | Concern | Missing | Not Applicable",
              "severity": "High | Medium | Low",
              "explanation": "string"
            }
          ],
          "error": "string, only present if the agent call failed for this patient"
        }
      }
    ]
  }
}
```

`potentialConflicts` and `concerns` items carry a `severity` rating (`High`/`Medium`/`Low`) so serious flags can still force `Needs Review`. `criteriaAssessments` is the primary v3 scoring input: it maps each semantic trial criterion to an outcome (`Supported`, `Conflict`, `Concern`, `Missing`, or `Not Applicable`) plus severity, allowing the Eligibility Scoring Agent to apply the weighted clinical scoring buckets. `totalSupplementalCriteriaCount` is still returned for backward compatibility and coarse fallback behavior.

The Flutter Ranked Patient Match Dashboard keeps the dashboard body quiet while matching runs and puts a simple "This may take a while for large patient sets." note in the progress dialog. Because the backend does not stream real per-patient progress, the dialog uses conservative estimated progress: it advances slowly, stops around the middle of the selected batch with "Reviewing remaining patients" while the backend is still reviewing/scoring, and only shows completion once ranked results actually return. The progress dialog has a Cancel action during active ranking that closes the dialog, stops local progress, restores the visible dashboard state from before the run, and ignores any late response from that cancelled request. The dashboard is the trial detail page's patient-matching review surface; the older bottom "Matched Patients" table and its custom criteria dialog are no longer shown. The shared Flutter sidebar no longer exposes disabled AI Workflow placeholders or trial-detail jump links; wide layouts keep the sidebar visible, smaller layouts use the app-bar drawer, and the navigation contains only the global Clinical Trials links for Trial List and Create Trial. The dashboard columns are ordered for workflow review: deterministic summary, semantic summary, recommendation, then explanation. Deterministic Summary keeps compact circular-bullet rows in the table and adds a full deterministic summary dialog backed by `deterministicResult.criteriaDetails`, showing criteria, patient data, and result. When opening the full deterministic dialog, Flutter may load the patient profile endpoint to repair stale saved pregnancy rows: if the trial pregnancy rule is unrestricted, the result remains `Not Applicable`, but the patient-data column should show the stored `patients_pathology.pregnancies` value when available. Semantic Summary is generated in Flutter from the existing `semanticComparison` payload, prioritizing `criteriaAssessments` conflicts/concerns/missing evidence before supporting factors, so no additional backend call or stored response field is required. When a `criteriaAssessments` item includes an explanation, the UI prefers that patient-specific explanation over the raw trial criterion text and appends the criterion as context when useful. Semantic Summary and Recommendation show compact circular-bullet summary previews in the table, while "View full ..." actions open the complete detailed lists. Explanation uses a capped clinical-rationale preview with a full explanation dialog; action-like/suggested-step text is filtered from the displayed explanation so next steps stay in the dedicated Recommendation column. The detailed pipeline explanation lives in the title info dialog, which uses section headers and bullet-style pipeline steps for reviewers: deterministic rule checks run first, the Semantic Patient-Trial Comparison Agent reviews clinical meaning per patient, the Eligibility Scoring Agent applies the scoring formula, and the Explanation and Recommendation Agent summarizes the clinical rationale and next steps. The same dialog summarizes the active v3 weights in a table: Objective eligibility 25%, Core clinical fit 35%, Clinical exclusion safety 25%, and Additional trial / criteria fit 15%, with hard deterministic exclusions handled before the percentage model. The dialog also explains that Refresh Saved Results may produce slightly different scores because it reruns AI semantic comparison/explanation; the scoring formula is deterministic, but it recalculates from the newly returned semantic assessments. It sets the expectation that strong candidates should generally remain in similar positions, while large ranking changes usually indicate the refreshed semantic review found meaningfully different clinical support or concern.

A per-patient agent failure does not fail the whole request; that patient's `semanticComparison` gets an `error` field and empty lists instead, so one bad OpenAI call doesn't block results for the rest of the batch.

### Debugging

`GET /api/clinical-trial-poc/semantic-compare/:trialId?patientIds=1,2,3` runs the same comparison and returns the same response shape, for testing straight from a browser URL bar or curl without a POST client. `patientIds` is optional (comma-separated); if omitted, it defaults to only the **first 2 patients** (by `id`) rather than the full patient set.

**This is not a passive/read-only debug endpoint like `GET /semantic-criteria/:trialId` is.** It executes the live agent pipeline - a real OpenAI call per patient, sequentially - every time it's hit. Nothing about semantic comparison output is stored anywhere yet, so there is no cheap "just show me what's already computed" version. The 2-patient default exists specifically to keep casual browser testing cheap; pass explicit `patientIds` to test against more. Not used by the Flutter app - the real POST endpoint has no such limit and defaults to all patients.

## POST /api/clinical-trial-poc/score-eligibility

### Purpose

Combine narrowed deterministic matching and semantic comparison into score and status.

This endpoint supports the Eligibility Scoring Agent. Unlike the field extractor, supplemental criteria, and semantic comparison agents, this one is **not an OpenAI call** - it is a plain, auditable formula (`eligibilityScoringService.js`) that combines the already-computed `deterministicResult` and `semanticComparison` for each patient. It only needs those two objects as input (matching the original draft shape below); it does not read from the database or call any external agent itself.

### Scoring rules (v3 weighted clinical model)

The ranked pipeline now treats most clinically meaningful trial criteria as semantic, so the score is no longer a mostly deterministic base with a small semantic adjustment. Non-hard-excluded patients are scored with a fixed 100-point weighted model:

| Criteria area | Weight | Fields included |
|---|---:|---|
| Objective eligibility | 25% | Gender, age range, allowed BMI range, pregnancy exclusion |
| Core clinical fit | 35% | Primary Pathology / Target Condition and Related Conditions |
| Clinical exclusion safety | 25% | Disease, surgery, medication, safety, contraindication, and other exclusion conflicts |
| Additional trial / criteria fit | 15% | Additional Trial / Criteria Information Not Captured by the Base Form |

- **Hard deterministic exclusions still override the percentage model.** If `deterministicResult.hardExclusionFlags` is non-empty, the score is confined to **[0, 25]** and status is forced to `Not Eligible`. In the current POC ranked pipeline, deterministic hard failures can come from gender, age, allowed BMI range, or pregnancy exclusion.
- **Objective eligibility is rule-based.** Matched objective fields receive full credit, while failed or missing objective fields receive no credit. Missing objective data lowers confidence and can trigger review, but it does not increase the score.
- **Semantic criteria are scored from per-criterion AI assessments.** The Semantic Patient-Trial Comparison Agent returns `criteriaAssessments` with `category`, `criterion`, `outcome`, `severity`, and `explanation`. Outcomes map to bucket credit as follows: `Supported` and `Not Applicable` count positively; `Conflict` lowers the relevant bucket most strongly; `Concern` lowers it moderately; `Missing` adds no score credit while flagging review.
- **Semantic category controls the weighted bucket.** Pathology/target-condition and related-condition assessments feed Core clinical fit. Disease/surgery/medication/exclusion/safety/contraindication assessments feed Clinical exclusion safety. Other supplemental/manual criteria feed Additional trial / criteria fit.
- **Semantic severity affects the amount of credit lost inside a bucket.** High-severity conflicts receive the least credit, Medium conflicts receive partial credit, and Low conflicts receive more partial credit. High-severity conflicts still force `Needs Review` even if the numeric score is otherwise strong.
- **Missing information affects confidence, not score support.** If missing objective fields exist, semantic comparison is unavailable, or at least 30% of semantic assessments are missing, a Strong/Likely score is downgraded to `Needs Review`. Missing criteria are treated as unresolved evidence rather than confirmed eligibility evidence.
- **Status** is mapped from the final score (`Strong Match` >=80, `Likely Match` >=60, `Weak Match` >=35, else `Not Eligible`), with the `Needs Review` overrides above.
- `scoreBreakdown` includes the legacy `deterministicContribution` and `semanticContribution` fields plus the v3 component fields: `objectiveEligibilityContribution`, `coreClinicalFitContribution`, `clinicalExclusionSafetyContribution`, and `additionalCriteriaFitContribution`.

### Historical v2 scoring rules (superseded on 2026-07-10)

Revised after manual review of v1 surfaced three problems: hard exclusions flattened to one flat score with no differentiation; semantic penalties/bonuses were flat point-per-item, which scales with how many supplemental criteria a trial happens to have (biasing well-documented trials); and the 0/100 extremes were trivially reachable. All three are fixed below.

- **Banded, not flattened, hard exclusion.** If `deterministicResult.hardExclusionFlags` is non-empty, the score is confined to **[0, 25]**, scaled by how well the patient otherwise matched (`matchedFields / (matchedFields + failedFields)`) - so a near-total mismatch scores near 0 and a near-miss (everything else matched, one exclusion tripped) scores near 25, rather than every hard-excluded patient collapsing to the same number. **Status is unconditionally forced to `Not Eligible`** regardless of where in that band the score lands - semantic support can never buy back a deterministic hard exclusion, only the *ranking within* the excluded group is graded. In the current POC ranked pipeline, deterministic hard failures are gender, age, allowed BMI range, and pregnancy exclusion.
- **Non-excluded patients score in [25, 100]**: `deterministicBase = 25 + 60 × deterministicRatio`, minus a penalty (up to 15) for missing deterministic fields, ratio-based the same way (`missingFields / totalDeterministicCriteriaChecked`) rather than flat-per-item.
- **Semantic adjustment is ratio-based against that trial's `totalSupplementalCriteriaCount`, not flat counts** - this is the key fix for cross-trial fairness: `conflictRatio = severityWeightedSum(potentialConflicts) / totalSupplementalCriteriaCount` (severity weights: High=3, Medium=2, Low=1), same pattern for `concerns`; `supportRatio` and `missingInfoRatio` use plain counts over the same denominator. Adjustment: `+ supportRatio×15 − conflictRatio×35 − concernRatio×15 − missingInfoRatio×10`. If `semanticComparison` is missing or errored, a flat `-10` applies instead (ratios can't be computed without it).
- **High semantic conflicts get an extra rank penalty.** In addition to the ratio-based semantic conflict penalty above, any High-severity `potentialConflicts` item subtracts an extra 15 raw points before the curve. A High-severity conflict that says the patient lacks evidence of the trial's target condition/pathology subtracts another 20 raw points. This keeps a patient who passes objective fields but lacks the trial's target condition from floating above a clinically closer patient.
- **Uncertain threshold conflicts are not scored like confirmed exclusions.** If a High-severity semantic conflict is threshold/lab based but explicitly says the needed value is unknown or not provided (for example eGFR or HbA1c is missing), scoring treats it as Medium severity while still preserving the original reviewer-facing conflict text.
- **Target-condition support matters more than demographic fit.** The current ranked pipeline intentionally treats age, gender, BMI, and pregnancy as objective deterministic checks, while target-condition/pathology evidence is semantic. A patient with no semantic evidence of the trial's target condition should rank below patients who have the target condition, even when the non-target patient passes the objective deterministic fields.
- **Missing threshold data remains a review item.** Missing eGFR/HbA1c/electrolyte values should usually create `Needs Review` and a dashboard note, but should not be scored as a confirmed exclusion unless the patient context actually includes a failing value.
- **Final composite is passed through a `tanh` compression** (`50 + 50×tanh((raw−50)/35)`) so the true extremes (0 and 100) become asymptotic rather than a hard floor/ceiling reachable by an ordinary case - a raw ~100 lands around 95, a raw ~0 lands around 5.
- **Status**, mapped from the curved score (`Strong Match` ≥80, `Likely Match` ≥60, `Weak Match` ≥35, else `Not Eligible`), with two overrides:
  - Any `High`-severity `potentialConflicts` item **unconditionally forces `Needs Review`**, regardless of score tier - a serious flag means "a human needs to look at this," which is a different meaning from "this is generally a weak match."
  - Missing deterministic fields, a semantic missing-information ratio ≥0.3, or semantic comparison being unavailable **downgrades** (not forces) `Strong Match`/`Likely Match` down to `Needs Review` - a confident-looking score shouldn't be presented as confident when there's a real, unresolved gap.
- `scoreBreakdown` includes `deterministicContribution`, `semanticContribution`, `rawScoreBeforeCurve` (the pre-curve composite, so the curve step is auditable rather than an opaque final jump), and `penalties` (human-readable, for the Explanation and Recommendation Agent (Task 10) to build on).

### Request

```json
{
  "totalSupplementalCriteriaCount": 5,
  "patients": [
    {
      "patientId": "string or number",
      "patientName": "string",
      "deterministicResult": {},
      "semanticComparison": {}
    }
  ]
}
```

`totalSupplementalCriteriaCount` is retained for backward compatibility with older debug callers. In the v3 weighted model, scoring primarily uses `semanticComparison.criteriaAssessments`; if those assessments are missing, the service falls back to a coarse legacy estimate using the older semantic lists and `totalSupplementalCriteriaCount`.

### Response

```json
{
  "status": "OK",
  "result": {
    "patients": [
      {
        "patientId": "string or number",
        "patientName": "string",
        "score": 85,
        "status": "Likely Match",
        "scoreBreakdown": {
          "deterministicContribution": "number",
          "semanticContribution": "number",
          "objectiveEligibilityContribution": "number",
          "coreClinicalFitContribution": "number",
          "clinicalExclusionSafetyContribution": "number",
          "additionalCriteriaFitContribution": "number",
          "rawScoreBeforeCurve": "number",
          "rawScore": "number",
          "penalties": ["string"]
        }
      }
    ]
  }
}
```

### Debugging

`GET /api/clinical-trial-poc/full-match-debug/:trialId?patientIds=1,2` chains deterministic matching + semantic comparison + eligibility scoring for one trial in a single call, returning each patient's `deterministicResult`, `semanticComparison`, `score`, `status`, and `scoreBreakdown` together. Same cost/behavior caveats as the `semantic-compare` debug route apply (real OpenAI calls, defaults to 2 patients). This previews what the future Task 12 orchestrator will do end to end, but nothing here is persisted yet. Not used by the Flutter app.

## POST /api/clinical-trial-poc/explain-recommend

### Purpose

Generate explanation and suggested actions for each scored patient.

This endpoint supports the Explanation and Recommendation Agent (Task 10). Unlike scoring, this **is** an OpenAI call - explaining *why* a score came out the way it did, in fluent language, is exactly the kind of generation work an LLM is for. It is explicitly told not to recompute or second-guess the score/status, only to explain it, and never to state or imply a final medical/enrollment decision. It is also told to keep `explanation` to concise clinical rationale only and keep coordinator action instructions in `suggestedActions`, because the dashboard already has a dedicated Suggested Next Step column. Calls OpenAI once per patient, sequentially.

The primary suggested action button shown in the dashboard (`primaryAction`) is **not** produced by the LLM - it is derived deterministically from `status` (`Strong Match`/`Likely Match` -> "Invite Patient", `Needs Review` -> "Confirm Details", `Weak Match`/`Not Eligible` -> "Do Not Invite"), so the UI always shows one of a small, consistent set of actions instead of the model inventing arbitrary verbs. The model's free-form `suggestedActions` are displayed as the supporting next-step list underneath that button.

### Request

```json
{
  "patients": [
    {
      "patientId": "string or number",
      "patientName": "string",
      "score": 85,
      "status": "Likely Match",
      "scoreBreakdown": {},
      "deterministicResult": {},
      "semanticComparison": {}
    }
  ]
}
```

### Response

```json
{
  "status": "OK",
  "result": {
    "patients": [
      {
        "patientId": "string or number",
        "patientName": "string",
        "score": 85,
        "status": "Likely Match",
        "primaryAction": "Invite Patient | Confirm Details | Do Not Invite",
        "explanation": "string",
        "suggestedActions": ["string"],
        "error": "string, only present if the agent call failed for this patient"
      }
    ]
  }
}
```

A per-patient agent failure does not fail the whole request; that patient gets an `error` field, an empty `explanation`, and empty `suggestedActions` (with `primaryAction` still derived normally from `status`, since that doesn't depend on the LLM call).

## POST /api/clinical-trial-poc/ranked-patients

### Purpose

Return the final ranked patient dashboard data for one trial: chains deterministic matching (7) + semantic comparison (8) + eligibility scoring (9) + explanation and recommendation (10) for selected candidate patients, then ranks by score. This is the real, production endpoint the Flutter Ranked Patient Match Dashboard calls.

This recomputes the selected batch live, then saves or updates one row per trial-patient pair in `clinical_trial_match_results`. For many patients this makes two sequential OpenAI calls per patient (semantic comparison, then explanation) and can take a noticeable amount of time; the Flutter UI offers "Match Next 10 Patients" and "Match All Patients" from a "Match Patients" menu and shows progress while it waits.

When explicit `patientIds` are provided, the endpoint recomputes those patients even if they already have saved ranked rows, then overwrites the existing rows through the same upsert path. The Flutter dashboard uses this only for "Refresh Saved Results". When `patientIds` is omitted, the backend ignores arbitrary client limits and selects unmatched patients by `mode`: `next` chooses the next 10 patients without a saved result for the trial, ordered by patient ID; `all` chooses every patient without a saved result. Existing saved current results are skipped, and the unique trial/patient upsert prevents duplicate rows.

### Request

```json
{
  "trialId": "string or number",
  "patientIds": ["optional explicit list of patient IDs"],
  "mode": "next | all; used only when patientIds is omitted"
}
```

### Response

```json
{
  "status": "OK",
  "result": {
    "trialId": "string or number",
    "mode": "next | all | explicit",
    "patientIds": ["patient IDs selected for this run"],
    "requestedCount": 10,
    "matchedCount": 10,
    "skippedCount": 0,
    "failedCount": 0,
    "patients": [
      {
        "rank": 1,
        "patientId": "string or number",
        "patientName": "string",
        "score": 92,
        "status": "Strong Match",
        "primaryAction": "Invite Patient",
        "explanation": "string",
        "suggestedActions": ["string"],
        "deterministicResult": {},
        "semanticComparison": {},
        "scoreBreakdown": {}
      }
    ]
  }
}
```

`deterministicResult`, `semanticComparison`, and `scoreBreakdown` are included per patient so the dashboard can render the deterministic match summary and full explanation detail without a second round trip.

## GET /api/clinical-trial-poc/ranked-patients/:trialId

### Purpose

Return saved ranked dashboard rows for one trial without rerunning deterministic matching or any OpenAI agent calls. This is what the Flutter detail page uses on load so ranked results persist after refresh/restart.

### Response

```json
{
  "status": "OK",
  "result": {
    "trialId": "string or number",
    "patientIds": ["patient IDs with saved ranked rows"],
    "patients": [
      {
        "rank": 1,
        "patientId": "string or number",
        "patientName": "string",
        "score": 92,
        "status": "Strong Match",
        "primaryAction": "Invite Patient",
        "explanation": "string",
        "suggestedActions": ["string"],
        "deterministicResult": {},
        "semanticComparison": {},
        "scoreBreakdown": {},
        "lastEvaluatedAt": "datetime string"
      }
    ]
  }
}
```

Saved rows are re-ranked by stored score on read. When scores tie, the backend's stored-result ranking uses patient ID as a stable tie-breaker. The endpoint is read-only and returns an empty `patients` array when no ranked rows have been generated yet. Because this endpoint does not recompute, scoring-rule changes are not reflected until `POST /ranked-patients` is called again for those patient IDs, which is what the Flutter dashboard's "Refresh Saved Results" action does.

## POST /api/clinical-trial-poc/update-trial

### Purpose

Update an existing clinical trial without deleting or recreating it. The endpoint preserves the immutable `clinical_trials.trial_id`, company identity, trial status, workflow history, invitations, applications, actions, patient profiles, and other related records.

The endpoint updates the existing `clinical_trials` row, the associated `clinical_trials_contacts` row, and saved `clinical_trial_semantic_criteria` only when the frontend explicitly sends changed/replacement semantic criteria. It performs server-side normalized criteria comparison and clears saved ranked dashboard rows only when effective eligibility criteria changed.

### Request

```json
{
  "formDataToSubmit": {
    "trialId": "string or number, immutable existing trial_id",
    "firstName": "string",
    "middleName": "string",
    "lastName": "string",
    "phone": "area code string",
    "phoneNumber": "string",
    "email": "string",
    "trialName": "string",
    "officialTitle": "string",
    "briefSummary": "string",
    "detailedDescription": "string",
    "country": "string",
    "region": "string",
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD or empty",
    "primaryPurpose": "string",
    "trialPhase": "string",
    "studyType": "string",
    "allocation": "string",
    "interventionModel": "string",
    "masking": "None (Open Label) | Single | Double | string",
    "maskingDetails": {
      "participant": true,
      "investigator": true
    },
    "sponsor": "string",
    "principalInvestigator": "string",
    "ethicsApproval": "string",
    "relatedConditions": "string",
    "pathology": "string",
    "ageRange": "min-max string",
    "gender": "Male | Female | Both",
    "bmi": "allowed BMI string such as > 18 and < 40",
    "diseases": "string",
    "surgeries": "string",
    "priorMedications": "string",
    "pregnancy": "Yes | No | Unrestricted"
  },
  "companyInfo": {
    "id": 1,
    "name": "Company Name"
  },
  "semanticCriteria": {
    "changed": true,
    "sourceType": "manual_form or supplemental_agent",
    "additionalTrialInformation": [],
    "summary": "string",
    "missingOrAmbiguousCriteria": []
  }
}
```

`semanticCriteria` is omitted when the saved additional criteria were not intentionally changed. When it is provided, the backend upserts the existing `clinical_trial_semantic_criteria` row for the trial instead of creating duplicates. Uploaded-document criteria keep `sourceType = "supplemental_agent"` even if the user additively adds, edits, or deletes individual criteria in Flutter; individual items may include backward-compatible `origin` or `userEdited` metadata. Deleting a criterion sends the remaining `additionalTrialInformation` array in the same JSON format. An empty array is valid and represents "no additional criteria"; it does not remove or duplicate the semantic criteria row.

### Response

```json
{
  "status": "OK",
  "result": {
    "success": true,
    "trialId": 21,
    "criteriaChanged": true,
    "clearedRankedResultCount": 5
  }
}
```

### Criteria Invalidation Policy

The backend compares the persisted old matching criteria with the normalized incoming matching criteria inside the update transaction.

Eligibility-related fields that clear saved ranked results when effectively changed:

- `related_conditions`
- `pathology` / Primary Pathology / Target Condition
- `age_range`
- `gender`
- `exclusion_criteria.BMI`
- `exclusion_criteria.Diseases`
- `exclusion_criteria.Surgeries`
- `exclusion_criteria.PriorMedications` / `Prior Medications`
- `exclusion_criteria.Pregnancy`
- saved `clinical_trial_semantic_criteria` source type, summary, and criteria JSON

General/administrative fields that do not clear ranked results by themselves:

- contact first, middle, and last name
- area code, phone number, and email
- trial name
- official title
- brief summary
- detailed description
- start and end dates
- primary purpose
- trial phase
- study type
- allocation
- intervention model
- masking
- location
- sponsor
- principal investigator
- ethics approval
- trial status

Detailed Description remains a general overview field and is not treated as manual supplemental eligibility criteria.

Normalization prevents false invalidation from null versus empty strings, leading/trailing or repeated whitespace, compatible medication-exclusion key variants, common BMI range formatting differences, and semantic-criteria JSON object key order differences.

When `criteriaChanged` is true, the endpoint deletes only rows for that trial from `clinical_trial_match_results`. It does not delete the trial, patient profiles, invitations, trial actions, applications, workflow history, or the newly updated semantic criteria.

## POST /api/clinical-trial-poc/delete-trial

### Purpose

Delete a clinical trial from the local POC database and clean up dependent POC/clinical-trial rows so the same study can be re-tested.

### Request

```json
{
  "trialId": "string or number"
}
```

### Response

```json
{
  "status": "OK",
  "result": {
    "trialId": "string or number"
  }
}
```

The endpoint removes rows from `clinical_trial_match_results`, `clinical_trial_semantic_criteria`, `ClinicalTrials_Patients`, `clinical_trials_contacts`, `ClinicalTrials_ActionResponses`, `ClinicalTrials_ActionRequests`, `ClinicalTrials_Actions`, and finally `clinical_trials` inside one transaction.

## Match Status Draft Values

The current draft status values are:

- Strong Match
- Likely Match
- Needs Review
- Weak Match
- Not Eligible

These can be changed later, but they should remain consistent across backend, frontend, scoring, and dashboard display.
