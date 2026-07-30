function modelName() {
  return process.env.OPENAI_MODEL || "gpt-4.1-mini";
}

const SEVERITY_LEVELS = ["High", "Medium", "Low"];

function ensureStringList(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => String(item || "").trim())
    .filter((item) => item.length > 0);
}

// Used for potentialConflicts/concerns, which need a severity rating so the
// Eligibility Scoring Agent can weight "this is a minor detail" differently
// from "this is likely disqualifying" instead of treating every item the
// same. Accepts either the intended {description, severity} shape or a bare
// string (defaults to "Medium") in case the model doesn't fully comply.
function ensureSeverityItemList(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (item && typeof item === "object") {
        const description = String(item.description || "").trim();
        if (!description) return null;
        const severity = SEVERITY_LEVELS.includes(item.severity) ? item.severity : "Medium";
        return { description, severity };
      }
      const description = String(item || "").trim();
      return description ? { description, severity: "Medium" } : null;
    })
    .filter((item) => item !== null);
}

function ensureCriteriaAssessmentList(raw) {
  if (!Array.isArray(raw)) return [];
  const validOutcomes = new Set([
    "Supported",
    "Conflict",
    "Concern",
    "Missing",
    "Not Applicable",
  ]);
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const category = String(item.category || "").trim();
      const criterion = String(item.criterion || "").trim();
      if (!category && !criterion) return null;
      return {
        category: category || "General",
        criterion,
        outcome: validOutcomes.has(item.outcome)
          ? item.outcome
          : "Missing",
        severity: SEVERITY_LEVELS.includes(item.severity)
          ? item.severity
          : "Medium",
        explanation: String(item.explanation || "").trim(),
      };
    })
    .filter((item) => item !== null);
}

function summarizedTrialContext(trialContext = {}) {
  return JSON.stringify(
    {
      trialName: trialContext.trialName || null,
      deterministicCriteriaForReferenceOnly: {
        gender: trialContext.gender || null,
        ageRange: trialContext.ageRange || null,
        bmiRange: trialContext.bmiRange || null,
        pregnancyExclusion: trialContext.pregnancyExclusion || null,
      },
      semanticClinicalCriteriaFromTrialForm:
        trialContext.semanticClinicalCriteria || [],
      supplementalCriteria: {
        summary: trialContext.supplementalSummary || null,
        additionalTrialInformation: trialContext.additionalTrialInformation || [],
      },
    },
    null,
    2
  );
}

function summarizedPatientContext(patientContext = {}) {
  return JSON.stringify(
    {
      diagnosis: patientContext.diagnosis || null,
      diagnosisClassifications: patientContext.diagnosisClassifications || [],
      medications: patientContext.medications || null,
      surgeries: patientContext.surgeries || null,
      pregnancies: patientContext.pregnancies ?? null,
      medicalHistory: patientContext.medicalHistory || null,
      otherNotes: patientContext.otherNotes || null,
    },
    null,
    2
  );
}

function comparisonPrompt(trialContext, patientContext) {
  return [
    {
      role: "system",
      content:
        "You are the Semantic Patient-Trial Comparison Agent for an e-Hospital clinical trials POC. You compare the trial's semantic clinical criteria against the patient's clinical context. Semantic clinical criteria include multi-value/free-text trial form fields such as related conditions, pathology/target condition text, disease exclusions, surgery exclusions, medication exclusions, and supplemental document criteria. Deterministic matching is handled separately for objective fields such as age, gender, BMI, and pregnancy; do not re-score those deterministic fields. You describe medically relevant similarities, conflicts, missing information, and concerns. You do not produce a final eligibility score, match status, or recommendation - that is a separate agent's job. Return strict JSON only.",
    },
    {
      role: "user",
      content: `Compare this trial's semantic clinical eligibility criteria against this patient's clinical context.

Trial criteria and identity:
${summarizedTrialContext(trialContext)}

Patient clinical context:
${summarizedPatientContext(patientContext)}

Rules:
- Base every statement only on the information given above; do not invent patient history or trial criteria.
- Treat semanticClinicalCriteriaFromTrialForm and supplementalCriteria.additionalTrialInformation as the trial criteria to compare semantically.
- Treat "Pathology / Target Condition" as required target-condition evidence. If the patient record does not show the target condition, related diagnosis, or clinically equivalent history, add a High-severity potentialConflict. Never list absence of the target condition as a supporting factor.
- Treat "Related Conditions" as target-condition context/synonyms, not as exclusions. A patient supports this criterion only when their diagnosis, diagnosis classifications, medical history, or notes show the target condition or a clinically equivalent related condition.
- Treat disease, surgery, and medication exclusion categories as exclusion checks. Absence of those exclusions can be mentioned briefly, but it should not outweigh missing target-condition evidence.
- Treat medication requirements in supplemental criteria (for example being on a specific number/type of current medications) as required evidence to compare against the patient's medication list. If the medication list is absent or does not show the required regimen, put that gap in missingInformation or potentialConflicts based on how strongly it affects eligibility.
- Compare trial related conditions/pathology/disease exclusions against the patient's diagnosis, diagnosis classifications, medical history, and other notes.
- Compare trial medication exclusions against the patient's medications, medical history, and other notes.
- Compare trial surgery exclusions against the patient's surgeries, medical history, and other notes.
- Use deterministicCriteriaForReferenceOnly only as context; age, gender, BMI, and pregnancy are scored separately by deterministic matching.
- "supportingFactors" are patient details that align with a semantic clinical criterion.
- "potentialConflicts" are patient details that may conflict with a semantic clinical criterion. Flag these clearly rather than silently deciding the patient is ineligible. Rate each one's "severity": "High" if it looks likely disqualifying or clinically serious, "Medium" if it's a real concern but not obviously disqualifying, "Low" if it is a minor or borderline detail.
- "missingInformation" lists semantic clinical criteria that cannot be evaluated because the patient record lacks the relevant detail.
- "concerns" covers anything else medically relevant a human reviewer should double-check, each also rated "severity" using the same High/Medium/Low scale.
- "criteriaAssessments" must include one item for each semantic clinical criterion you can identify from semanticClinicalCriteriaFromTrialForm and supplementalCriteria.additionalTrialInformation. Use the trial criterion's category where possible. Outcome must be "Supported", "Conflict", "Concern", "Missing", or "Not Applicable". Use "Not Applicable" when an exclusion criterion is absent from the patient record and therefore creates no conflict.
- If there is no semantic clinical criteria to compare, or no patient context to compare it against, say so plainly in "summary" and leave the lists empty or note the gap in "missingInformation".
- Do not include a score, match status, or eligibility recommendation anywhere in the response.

Return JSON with this exact top-level shape:
{
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
  ]
}`,
    },
  ];
}

function parseJsonContent(content) {
  const trimmed = String(content || "").trim();
  try {
    return JSON.parse(trimmed);
  } catch (error) {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw error;
    return JSON.parse(match[0]);
  }
}

async function callOpenAiComparisonAgent(trialContext, patientContext) {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error(
      "Semantic Patient-Trial Comparison Agent requires OPENAI_API_KEY in backend_copy/.env."
    );
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: modelName(),
      messages: comparisonPrompt(trialContext, patientContext),
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      body.error && body.error.message
        ? body.error.message
        : "OpenAI semantic comparison request failed.";
    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }

  const content = body.choices?.[0]?.message?.content;
  if (!content) {
    const error = new Error("OpenAI semantic comparison returned an empty response.");
    error.statusCode = 502;
    throw error;
  }

  return parseJsonContent(content);
}

async function compareTrialToPatient(trialContext, patientContext) {
  const llmResult = await callOpenAiComparisonAgent(trialContext, patientContext);

  return {
    summary: String(llmResult.summary || "").trim(),
    supportingFactors: ensureStringList(llmResult.supportingFactors),
    potentialConflicts: ensureSeverityItemList(llmResult.potentialConflicts),
    missingInformation: ensureStringList(llmResult.missingInformation),
    concerns: ensureSeverityItemList(llmResult.concerns),
    criteriaAssessments: ensureCriteriaAssessmentList(
      llmResult.criteriaAssessments
    ),
  };
}

module.exports = {
  compareTrialToPatient,
};
