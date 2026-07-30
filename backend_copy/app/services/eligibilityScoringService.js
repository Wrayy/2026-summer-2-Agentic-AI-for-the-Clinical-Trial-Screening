// Eligibility Scoring Agent.
//
// Deliberately a plain formula, not an OpenAI call: it only combines numbers
// and lists that the deterministic matching and semantic comparison steps
// already produced (and already paid the OpenAI cost for), so there is
// nothing left here that needs document interpretation. Keeping this
// algorithmic also keeps the score auditable - the Explanation and
// Recommendation Agent (Task 10) can describe *why* a score came out the
// way it did, instead of trying to justify another opaque model output.
//
// v3 design notes:
//
// 1. The ranked pipeline now treats most clinically meaningful fields as
//    semantic, so semantic fit should be central rather than a small +15
//    bonus on top of age/gender/BMI. The score is now a 100-point weighted
//    model: objective eligibility 25%, core clinical fit 35%, clinical
//    exclusion safety 25%, and additional trial/criteria fit 15%.
// 2. Hard deterministic exclusions still cap the score in [0, 25] and force
//    Not Eligible. A confirmed hard exclusion should not be averaged away by
//    semantic support.
// 3. Semantic scoring uses the semantic agent's per-criterion assessments
//    when available. Older semantic outputs without criteriaAssessments fall
//    back to a coarse legacy semantic estimate so debug callers don't crash.

const HARD_EXCLUSION_BAND_MAX = 25; // hard-excluded patients score within [0, 25]

const OBJECTIVE_ELIGIBILITY_WEIGHT = 25;
const CORE_CLINICAL_FIT_WEIGHT = 35;
const CLINICAL_EXCLUSION_SAFETY_WEIGHT = 25;
const ADDITIONAL_CRITERIA_FIT_WEIGHT = 15;

const SEMANTIC_UNAVAILABLE_SCORE_RATIO = 0;

const STATUS_THRESHOLDS = [
  { minScore: 80, status: "Strong Match" },
  { minScore: 60, status: "Likely Match" },
  { minScore: 35, status: "Weak Match" },
  { minScore: 0, status: "Not Eligible" },
];
const NEEDS_REVIEW = "Needs Review";
const HARD_EXCLUSION_STATUS = "Not Eligible";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function statusForScore(score) {
  const match = STATUS_THRESHOLDS.find((tier) => score >= tier.minScore);
  return match ? match.status : "Not Eligible";
}

function ratio(count, total) {
  if (!total || total <= 0) return 0;
  return clamp(count / total, 0, 1);
}

function deterministicFieldScore(matchedFields, failedFields, missingFields) {
  const total =
    matchedFields.length + failedFields.length + missingFields.length;
  if (total <= 0) return OBJECTIVE_ELIGIBILITY_WEIGHT;
  return (
    OBJECTIVE_ELIGIBILITY_WEIGHT *
    clamp(matchedFields.length / total, 0, 1)
  );
}

function normalizeUncertainThresholdConflict(item) {
  if (item?.severity !== "High") return item;
  const description = String(item.description || "").toLowerCase();
  const isUncertain =
    description.includes("unknown") ||
    description.includes("not provided") ||
    description.includes("no data") ||
    description.includes("requires verification") ||
    description.includes("to confirm") ||
    description.includes("unclear");
  const isThresholdBased =
    description.includes("egfr") ||
    description.includes("hba1c") ||
    description.includes("serum potassium") ||
    description.includes("serum sodium") ||
    description.includes("renal function") ||
    description.includes("electrolyte") ||
    description.includes("threshold");

  if (!isUncertain || !isThresholdBased) return item;
  return { ...item, severity: "Medium" };
}

function normalizeConflictsForScoring(items = []) {
  return items.map(normalizeUncertainThresholdConflict);
}

function highestSeverity(items = []) {
  if (items.some((item) => item?.severity === "High")) return "High";
  if (items.some((item) => item?.severity === "Medium")) return "Medium";
  if (items.length > 0) return "Low";
  return null;
}

function assessmentValue(assessment = {}) {
  const severity = assessment.severity || "Medium";
  switch (assessment.outcome) {
    case "Supported":
    case "Not Applicable":
      return 1;
    case "Missing":
      return 0;
    case "Concern":
      return severity === "High" ? 0.4 : severity === "Medium" ? 0.6 : 0.8;
    case "Conflict":
      return severity === "High" ? 0 : severity === "Medium" ? 0.25 : 0.5;
    default:
      return 0;
  }
}

function semanticBucket(category) {
  const text = String(category || "").toLowerCase();
  if (
    text.includes("pathology") ||
    text.includes("target") ||
    text.includes("related condition")
  ) {
    return "core";
  }
  if (
    text.includes("disease") ||
    text.includes("surgery") ||
    text.includes("surger") ||
    text.includes("medication exclusion") ||
    text.includes("exclusion") ||
    text.includes("contraindication") ||
    text.includes("safety")
  ) {
    return "exclusion";
  }
  return "additional";
}

function bucketScore(assessments, bucketName, weight) {
  const bucketAssessments = assessments.filter(
    (assessment) => semanticBucket(assessment.category) === bucketName
  );
  if (bucketAssessments.length === 0) return weight;
  const average =
    bucketAssessments.reduce(
      (sum, assessment) => sum + assessmentValue(assessment),
      0
    ) / bucketAssessments.length;
  return weight * clamp(average, 0, 1);
}

function fallbackCriteriaAssessments(semanticComparison = {}) {
  const assessments = [];
  for (const item of semanticComparison.supportingFactors || []) {
    assessments.push({
      category: "Additional Trial / Criteria Information",
      criterion: String(item || ""),
      outcome: "Supported",
      severity: "Low",
    });
  }
  for (const item of normalizeConflictsForScoring(
    semanticComparison.potentialConflicts || []
  )) {
    assessments.push({
      category: "Additional Trial / Criteria Information",
      criterion: item.description || "",
      outcome: "Conflict",
      severity: item.severity || "Medium",
    });
  }
  for (const item of semanticComparison.concerns || []) {
    assessments.push({
      category: "Additional Trial / Criteria Information",
      criterion: item.description || "",
      outcome: "Concern",
      severity: item.severity || "Medium",
    });
  }
  for (const item of semanticComparison.missingInformation || []) {
    assessments.push({
      category: "Additional Trial / Criteria Information",
      criterion: String(item || ""),
      outcome: "Missing",
      severity: "Medium",
    });
  }
  return assessments;
}

function scorePatient(deterministicResult = {}, semanticComparison = null, totalSupplementalCriteriaCount = 0) {
  const matchedFields = deterministicResult.matchedFields || [];
  const failedFields = deterministicResult.failedFields || [];
  const missingFields = deterministicResult.missingFields || [];
  const hardExclusionFlags = deterministicResult.hardExclusionFlags || [];

  const penalties = [];
  const objectiveScore = deterministicFieldScore(
    matchedFields,
    failedFields,
    missingFields
  );

  if (missingFields.length > 0) {
    penalties.push(
      `${missingFields.length} deterministic field(s) could not be evaluated: ${missingFields.join(", ")}.`
    );
  }

  if (hardExclusionFlags.length > 0) {
    penalties.push(`Hard exclusion criteria triggered: ${hardExclusionFlags.join(", ")}.`);
    const rawScore = clamp(
      HARD_EXCLUSION_BAND_MAX *
        ratio(objectiveScore, OBJECTIVE_ELIGIBILITY_WEIGHT),
      0,
      HARD_EXCLUSION_BAND_MAX
    );
    return {
      score: Math.round(rawScore),
      status: HARD_EXCLUSION_STATUS,
      scoreBreakdown: {
        deterministicContribution: Math.round(rawScore),
        semanticContribution: 0,
        objectiveEligibilityContribution: Math.round(rawScore),
        coreClinicalFitContribution: 0,
        clinicalExclusionSafetyContribution: 0,
        additionalCriteriaFitContribution: 0,
        rawScoreBeforeCurve: Math.round(rawScore),
        rawScore: Math.round(rawScore),
        penalties,
      },
    };
  }

  const semanticError = semanticComparison?.error;
  const semanticUnavailable = !semanticComparison || Boolean(semanticError);

  const potentialConflicts = semanticComparison?.potentialConflicts || [];
  const missingInformation = semanticComparison?.missingInformation || [];
  const scoredPotentialConflicts = normalizeConflictsForScoring(potentialConflicts);
  const criteriaAssessments =
    semanticComparison?.criteriaAssessments?.length > 0
      ? semanticComparison.criteriaAssessments
      : fallbackCriteriaAssessments(semanticComparison || {});

  if (semanticUnavailable) {
    penalties.push(
      semanticError
        ? `Semantic comparison failed: ${semanticError}.`
        : "Semantic comparison was not available for this patient."
    );
  }

  let coreClinicalFitScore = semanticUnavailable
    ? CORE_CLINICAL_FIT_WEIGHT * SEMANTIC_UNAVAILABLE_SCORE_RATIO
    : bucketScore(criteriaAssessments, "core", CORE_CLINICAL_FIT_WEIGHT);
  let clinicalExclusionSafetyScore = semanticUnavailable
    ? CLINICAL_EXCLUSION_SAFETY_WEIGHT * SEMANTIC_UNAVAILABLE_SCORE_RATIO
    : bucketScore(
        criteriaAssessments,
        "exclusion",
        CLINICAL_EXCLUSION_SAFETY_WEIGHT
      );
  let additionalCriteriaFitScore = semanticUnavailable
    ? ADDITIONAL_CRITERIA_FIT_WEIGHT * SEMANTIC_UNAVAILABLE_SCORE_RATIO
    : bucketScore(
        criteriaAssessments,
        "additional",
        ADDITIONAL_CRITERIA_FIT_WEIGHT
      );

  if (!semanticUnavailable) {
    if (potentialConflicts.length > 0) {
      penalties.push(
        `${potentialConflicts.length} potential semantic conflict(s) flagged for review: ${potentialConflicts
          .map((item) => `${item.description} (${item.severity})`)
          .join("; ")}.`
      );
    }
  }

  const rawScore = clamp(
    objectiveScore +
      coreClinicalFitScore +
      clinicalExclusionSafetyScore +
      additionalCriteriaFitScore,
    0,
    100
  );
  const score = Math.round(rawScore);

  const hasCriticalConflict = highestSeverity(scoredPotentialConflicts) === "High";
  const semanticMissingRatio = criteriaAssessments.length
    ? ratio(
        criteriaAssessments.filter(
          (assessment) => assessment.outcome === "Missing"
        ).length,
        criteriaAssessments.length
      )
    : ratio(missingInformation.length, totalSupplementalCriteriaCount);
  const hasMinorGaps =
    missingFields.length > 0 || semanticMissingRatio >= 0.3 || semanticUnavailable;

  let status = statusForScore(score);
  if (hasCriticalConflict) {
    status = NEEDS_REVIEW;
  } else if (hasMinorGaps && (status === "Strong Match" || status === "Likely Match")) {
    status = NEEDS_REVIEW;
  }

  return {
    score,
    status,
    scoreBreakdown: {
      deterministicContribution: Math.round(objectiveScore),
      semanticContribution: Math.round(
        coreClinicalFitScore +
          clinicalExclusionSafetyScore +
          additionalCriteriaFitScore
      ),
      objectiveEligibilityContribution: Math.round(objectiveScore),
      coreClinicalFitContribution: Math.round(coreClinicalFitScore),
      clinicalExclusionSafetyContribution: Math.round(
        clinicalExclusionSafetyScore
      ),
      additionalCriteriaFitContribution: Math.round(additionalCriteriaFitScore),
      rawScoreBeforeCurve: Math.round(rawScore),
      rawScore: Math.round(rawScore),
      penalties,
    },
  };
}

function scoreEligibility(patients, totalSupplementalCriteriaCount = 0) {
  if (!Array.isArray(patients)) {
    const error = new Error("patients must be an array for eligibility scoring.");
    error.statusCode = 400;
    throw error;
  }

  return {
    patients: patients.map((patient) => {
      const { score, status, scoreBreakdown } = scorePatient(
        patient.deterministicResult,
        patient.semanticComparison,
        totalSupplementalCriteriaCount
      );
      return {
        patientId: patient.patientId,
        patientName: patient.patientName,
        score,
        status,
        scoreBreakdown,
      };
    }),
  };
}

module.exports = {
  scoreEligibility,
  scorePatient,
};
