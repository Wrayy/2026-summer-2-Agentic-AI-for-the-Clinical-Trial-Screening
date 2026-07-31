# Project Brief

## Project Name

Agentic Clinical Trial Matching Proof of Concept for the e-Hospital Clinical Trials Component

## Project Purpose

The purpose of this project is to build a proof of concept that enhances the existing e-Hospital clinical trials component with an AI-assisted, multi-agent workflow for trial intake, patient matching, eligibility scoring, explanation generation, and ranked patient review.

The existing e-Hospital clinical trials component already supports core clinical trial functions, including trial creation, trial listing, trial detail viewing, patient profiles, hardcoded patient matching, and patient recruitment workflows. This project does not replace that foundation. Instead, it adds an AI-driven layer that helps automate and improve the process of extracting trial information from PDF/DOCX documents, identifying additional medically relevant criteria, comparing those criteria against patient information, and ranking patients by eligibility.

The goal is to help clinical trial users move from a manually entered, hardcoded matching process toward a richer AI-supported screening process.

## Existing Clinical Trial System Context

The existing clinical trials component is built around pharmaceutical company users. It includes modules for monitoring trials, viewing clinical trial lists, creating new clinical trials, viewing detailed trial information, viewing partnership patients, running advanced patient matching, viewing patient profiles, and managing trial-related actions such as audits, invitations, and applications.

The existing system already has structured clinical trial fields and patient fields that this project should respect. This project should not invent a completely separate data model unless necessary. Extracted information should map back into the existing clinical trial structure wherever possible.

The current system supports deterministic or hardcoded matching using fields such as pathology, gender, age range, BMI, diseases, medication exclusions, surgeries, and pregnancy. This project should build on that foundation by separating deterministic matching from semantic AI-based comparison. In the POC ranked-matching pipeline, deterministic matching is now intentionally narrower: objective fields such as gender, age, BMI, and pregnancy remain deterministic, while multi-value/free-text clinical fields such as related conditions, pathology wording, diseases, medication exclusions, and surgeries are treated as semantic clinical context.

## Current Clinical Trial Fields to Preserve

The existing clinical trial addition and trial detail pages include several important field groups.

For trial basic information, the system includes fields such as:

- Trial name
- Trial ID
- Official title
- Location
- Brief summary
- Detailed description
- Start date
- End date
- Sponsor
- Principal investigator
- Ethics approval
- Primary purpose
- Trial phase
- Study type
- Allocation
- Intervention model
- Masking

For inclusion criteria, the system includes fields such as:

- Related conditions
- Primary pathology / target condition
- Gender
- Age range

For exclusion criteria, the system includes fields such as:

- BMI range
- Diseases
- Surgeries
- Medication exclusions
- Pregnancy

These fields matter because the Clinical Trial Document Field Extractor should extract and populate these existing fields from uploaded trial documents. Some fields are stored/displayed on the form but are compared semantically rather than by exact deterministic string matching.

## Current Patient Fields to Preserve

The existing patient profile and matching logic use patient information such as:

- Patient name
- Patient ID
- Age
- Gender
- Height
- Weight
- BMI
- Blood type
- Location
- Diagnosis/pathology
- Prior medications
- Surgeries
- Pregnancies
- Doctors associated with the patient
- Enrollment or invitation status

The original deterministic matching process appears to compare patient data against trial criteria such as pathology, gender, age range, BMI, disease exclusions, medication exclusions, surgery exclusions, and pregnancy restrictions. The POC ranked-matching pipeline now keeps objective structured checks deterministic and moves clinical free-text/list checks into semantic comparison to avoid brittle exact string matching.

These patient fields should be treated as the foundation for deterministic matching and as input context for semantic comparison.

## Core Problem

The current clinical trial component relies heavily on structured fields and hardcoded criteria. This is useful for basic matching, but clinical trial documents often contain important eligibility details that are not captured cleanly in those fields.

For example, a trial document may include requirements about medication stability, disease severity, lab values, prior treatment history, contraindications, recent hospitalizations, or other medically relevant details that are not part of the existing hardcoded inclusion/exclusion fields.

The problem is that these additional criteria can affect eligibility but may be missed if the system only uses the existing structured fields.

This POC addresses that gap by separating the process into two layers:

1. The deterministic layer uses existing structured fields and hardcoded matching rules for objective criteria such as gender, age, BMI, and pregnancy.
2. The semantic layer uses AI agents to interpret multi-value/free-text clinical trial information and compare it against patient diagnosis/pathology, diagnosis classifications, medications, surgeries, medical history, and notes.

## Intended Users

The main intended users are pharmaceutical company users, clinical trial coordinators, research staff, and evaluators working with the e-Hospital clinical trials component.

For the POC, the user is likely someone reviewing or managing clinical trial recruitment. They want to upload or input a trial document, extract key trial information, identify eligible or likely eligible patients, and review ranked patient results with explanations and recommended next actions.

## Main Workflow

A user uploads a clinical trial PDF/DOCX document or manually enters a trial through the create-trial form.

For uploads, the Clinical Trial Document Field Extractor extracts the required structured trial fields that correspond to the existing e-Hospital clinical trial fields. This includes trial name and hardcoded inclusion/exclusion fields. For manual entries, the user directly fills those structured fields.

The Supplemental Criteria Interpretation Agent reads uploaded document text and extracts additional medically relevant trial criteria that are not already captured in the structured fields. For manual entries, the optional manual-only Additional Trial / Criteria Information Not Captured by the Base Form field is saved directly as manual semantic criteria so the detail view mirrors the user's text and does not turn base fields such as age into additional criteria. Detailed Description remains a general trial overview rather than the manual source for extra eligibility rules.

The deterministic matching process compares objective structured trial criteria against structured patient database fields.

The Semantic Patient-Trial Comparison Agent compares the additional trial information plus multi-value/free-text clinical form fields against patient clinical information and produces a summary of medically relevant eligibility considerations plus per-criterion assessments for scoring.

The Eligibility Scoring Agent combines deterministic matching results with semantic comparison assessments and produces a score from 0 to 100 and a match status.

The scoring layer is auditable and formula-based. The active v3 model uses explicit scoring buckets: Objective eligibility 25%, Core clinical fit 35%, Clinical exclusion safety 25%, and Additional trial / criteria fit 15%. Confirmed hard deterministic exclusions still cap the score in the 0-25 Not Eligible band, and missing threshold/lab values remain review items rather than confirmed exclusions unless the patient record contains the failing value.

The Explanation and Recommendation Agent uses the score, deterministic match/mismatch details, and semantic comparison summary to explain why the patient received that score and suggest next actions.

The Ranked Patient Dashboard displays patients ranked by match score, with status, explanation, and suggested actions.

## Agent Architecture

The intended architecture has six main components.

### 1. Clinical Trial Document Field Extractor

Input: PDF/DOCX clinical trial document text or manually typed create-trial criteria text.

Output: Required structured trial fields, especially the trial name and the existing hardcoded inclusion and exclusion criteria.

Purpose: Map document content into the existing clinical trial fields wherever possible.

### 2. Supplemental Criteria Interpretation Agent

Input: PDF or DOCX clinical trial document.

Output: Medically relevant trial information that is not already captured in the hardcoded fields.

Purpose: Extract additional trial criteria, contextual eligibility details, and medically relevant notes that may affect patient eligibility.

### 3. Semantic Patient-Trial Comparison Agent

Input: Additional trial information from the supplemental criteria agent and additional patient information from the patient database or patient profile.

Output: Summary of medically relevant similarities, conflicts, missing details, or concerns that may affect eligibility.

Purpose: Compare nuanced trial requirements against patient context. This agent does not produce final scoring or next-step recommendations.

### 4. Eligibility Scoring Agent

Input: Deterministic scoring result and semantic patient-trial comparison assessments.

Output: Match score from 0 to 100 and match status.

Purpose: Combine structured rule-based matching with semantic comparison output into a patient-level eligibility score using the weighted v3 clinical model.

### 5. Explanation and Recommendation Agent

Input: Match score, deterministic scoring details, and semantic comparison summary.

Output: Clear explanation of the match score and suggested actions.

Purpose: Explain the result in a way that can be reviewed by a human user.

### 6. Ranked Patient Dashboard

Input: Patient-level scoring and explanation outputs.

Output: Ranked patient view showing match score, status, explanation, and suggested actions.

Purpose: Help users review and prioritize patients for clinical trial screening.

## Deterministic Matching Role

The deterministic matching layer should continue to use structured fields from the existing system.

Examples of deterministic criteria include:

- Gender
- Age range
- BMI range
- Pregnancy restrictions

The deterministic layer should produce clear match details, such as which fields matched, which fields failed, and which fields were missing or uncertain.

This deterministic output is important because it becomes one of the inputs to the Eligibility Scoring Agent and the Explanation and Recommendation Agent.

## Semantic Matching Role

The semantic matching layer should not replace deterministic matching. It should supplement it.

Its purpose is to handle medically relevant information that does not fit neatly into existing structured fields.

Examples may include:

- Related conditions
- Pathology/target diagnosis wording
- Disease exclusions
- Surgery exclusions
- Medication exclusions
- Medication stability requirements
- Disease severity
- Required lab values
- Prior treatment response
- Comorbidity nuance
- Timing of surgeries
- Hospitalization history
- Other textual eligibility criteria from the trial document

The semantic comparison should produce a summary of relevant eligibility considerations. It should not be responsible for final scoring or recommendations.

## Expected Final Dashboard Output

The final ranked patient dashboard should show patients ordered by match score.

For each patient, the dashboard should include:

- Match score
- Match status
- Explanation
- Suggested actions

The match status could include categories such as Strong Match, Likely Match, Needs Review, Weak Match, or Not Eligible. The exact labels can be decided later, but they should be consistent across the backend, frontend, and scoring agent.

## Frontend Scope

The frontend will be built from scratch in Flutter.

The frontend does not need to reuse the existing React frontend. However, it should reflect the workflow of the existing clinical trial component: trial intake, patient matching, ranked results, and review of patient eligibility.

The frontend should support document upload or document input, show extracted trial fields, show supplemental criteria, display ranked patients, and allow users to inspect explanations and suggested actions.

Since this is a POC, the Flutter frontend should prioritize clarity and workflow demonstration over full production styling.

## Backend Scope

The backend will use a copied version of the existing e-Hospital backend from:

https://github.com/ottawa-ehospital/E-react-node-backend

Backend changes should be limited and tracked in the backend change record, because they may need to be reintegrated into the original backend later.

The backend should expose endpoints that support the agent workflow, likely including document upload/extraction, supplemental criteria extraction, deterministic matching, semantic comparison, eligibility scoring, explanation generation, and ranked patient retrieval.

The backend should preserve or reuse existing clinical trial and patient database structures where possible.

## Non-Goals

The project should not rebuild the entire e-Hospital platform.

It should not rebuild the existing React frontend unless required for backend understanding.

It should not replace the existing clinical trial database model unnecessarily.

It should not make final medical eligibility decisions without human review.

It should not allow AI-generated reasoning to override hard exclusion criteria without flagging the issue.

It should not heavily refactor the copied backend.

It should not attempt to fully automate clinical recruitment or patient enrollment.

## Success Criteria

The POC is successful if a user can upload or provide a clinical trial document, extract required structured fields, extract supplemental medically relevant criteria, compare the trial against patient records, generate deterministic and semantic matching outputs, score/rank patients, and display the results in a dashboard.

The result should clearly show each patient’s match score, status, explanation, and suggested action.

The system should also make it clear which parts of the result came from deterministic hardcoded matching and which parts came from semantic AI comparison.

Backend changes should be documented well enough that they can potentially be moved back into the original e-Hospital backend.

## Main Risks

The biggest technical risk is drifting too far from the existing backend and data model, making reintegration difficult.

The biggest product risk is allowing the AI workflow to become too vague. Each agent needs a clear input and output.

The biggest clinical safety risk is treating an AI-generated eligibility score as a final decision instead of a screening aid.

The biggest coordination risk is that different contributors may change the architecture inconsistently unless `PROJECT_BRIEF.md`, `API_CONTRACT.md`, `ARCHITECTURE.md`, and the backend change record stay updated.

## Recommended Project Principle

The project should be modular, explainable, and aligned with the existing e-Hospital clinical trials component.

The deterministic matching layer should remain visible.

The semantic AI layer should add nuance, not replace structured eligibility rules.

The scoring agent should combine both sources.

The explanation agent should make the result understandable to a human reviewer.

The dashboard should help users prioritize patients for review, not make final clinical decisions automatically.
