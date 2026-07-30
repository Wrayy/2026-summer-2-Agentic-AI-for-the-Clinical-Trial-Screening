const clinicalTrialDocumentExtractor = require("../services/clinicalTrialDocumentExtractorService");
const supplementalCriteriaAgent = require("../services/agents/supplementalCriteriaAgent");
const semanticCriteriaService = require("../services/semanticCriteriaService");
const deterministicMatchingService = require("../services/deterministicMatchingService");
const semanticComparisonService = require("../services/semanticComparisonService");
const eligibilityScoringService = require("../services/eligibilityScoringService");
const explanationService = require("../services/explanationService");
const matchResultService = require("../services/matchResultService");
const clinicalTrialUpdateService = require("../services/clinicalTrialUpdateService");
const db = require("../../db");
const { QueryTypes } = require("sequelize");

exports.extractTrialFields = async (req, res) => {
  try {
    const result = await clinicalTrialDocumentExtractor.extractTrialFields(req.file);
    res.json({
      status: "OK",
      result,
    });
  } catch (error) {
    console.error("Clinical trial field extraction failed:", error.message);
    res.status(error.statusCode || 500).json({
      success: false,
      status: "ERROR",
      errorCode: error.errorCode || "CLINICAL_TRIAL_EXTRACTION_FAILED",
      message: error.message || "Clinical trial field extraction failed.",
    });
  }
};

function manualTrialTextFromForm(formData = {}) {
  const inclusionCriteria = [
    formData.relatedConditions && `Related conditions: ${formData.relatedConditions}`,
    formData.pathology && `Pathology: ${formData.pathology}`,
    formData.gender && `Gender: ${formData.gender}`,
    formData.ageRange && `Age range: ${formData.ageRange}`,
  ].filter(Boolean);
  const exclusionCriteria = [
    formData.bmi && `BMI: ${formData.bmi}`,
    formData.diseases && `Diseases: ${formData.diseases}`,
    formData.surgeries && `Surgeries: ${formData.surgeries}`,
    formData.priorMedications &&
      `Medication exclusions: ${formData.priorMedications}`,
    formData.pregnancy && `Pregnancy: ${formData.pregnancy}`,
  ].filter(Boolean);

  return [
    formData.trialName && `Trial name: ${formData.trialName}`,
    formData.officialTitle && `Official title: ${formData.officialTitle}`,
    formData.additionalCriteriaInformation &&
      `Additional eligibility criteria information:\n${formData.additionalCriteriaInformation}`,
    inclusionCriteria.length &&
      `Structured inclusion criteria:\n${inclusionCriteria.join("\n")}`,
    exclusionCriteria.length &&
      `Structured exclusion criteria:\n${exclusionCriteria.join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function requiredFieldsFromManualForm(formData = {}) {
  return {
    trialName: formData.trialName || null,
    inclusionCriteria: {
      relatedConditions: formData.relatedConditions || null,
      pathology: formData.pathology || null,
      gender: formData.gender || null,
      ageRange: formData.ageRange || null,
    },
    exclusionCriteria: {
      bmiRange: formData.bmi || null,
      diseases: formData.diseases || null,
      surgeries: formData.surgeries || null,
      priorMedications: formData.priorMedications || null,
      pregnancy: formData.pregnancy || null,
    },
  };
}

exports.extractManualSupplementalCriteria = async (req, res) => {
  try {
    const formData = req.body.formData || {};
    const documentText = manualTrialTextFromForm(formData);
    if (!documentText.trim()) {
      return res.status(400).json({
        status: "ERROR",
        message: "Manual trial text is required for supplemental criteria extraction.",
      });
    }

    const result = await supplementalCriteriaAgent.extractSupplementalCriteriaFromText(
      documentText,
      requiredFieldsFromManualForm(formData),
      { filename: "manual-create-trial-form", sourceType: "manual_form" }
    );

    res.json({
      status: "OK",
      result,
    });
  } catch (error) {
    console.error("Manual supplemental criteria extraction failed:", error.message);
    res.status(error.statusCode || 500).json({
      status: "ERROR",
      message: error.message || "Manual supplemental criteria extraction failed.",
    });
  }
};

exports.saveSemanticCriteria = async (req, res) => {
  try {
    const {
      trialId,
      additionalTrialInformation,
      summary,
      missingOrAmbiguousCriteria,
      sourceType,
    } = req.body;
    const result = await semanticCriteriaService.saveSemanticCriteria({
      trialId,
      additionalTrialInformation,
      summary,
      missingOrAmbiguousCriteria,
      sourceType,
    });
    res.json({
      status: "OK",
      result,
    });
  } catch (error) {
    console.error("Saving semantic criteria failed:", error.message);
    res.status(error.statusCode || 500).json({
      status: "ERROR",
      message: error.message || "Saving semantic criteria failed.",
    });
  }
};

exports.getSemanticCriteria = async (req, res) => {
  try {
    const result = await semanticCriteriaService.getSemanticCriteria(req.params.trialId);
    res.json({
      status: "OK",
      result,
    });
  } catch (error) {
    console.error("Fetching semantic criteria failed:", error.message);
    res.status(error.statusCode || 500).json({
      status: "ERROR",
      message: error.message || "Fetching semantic criteria failed.",
    });
  }
};

exports.getDeterministicMatch = async (req, res) => {
  try {
    const { trialId } = req.body;
    const result = await deterministicMatchingService.getStructuredMatchesForTrial(trialId);
    res.json({
      status: "OK",
      result,
    });
  } catch (error) {
    console.error("Deterministic match failed:", error.message);
    res.status(error.statusCode || 500).json({
      status: "ERROR",
      message: error.message || "Deterministic match failed.",
    });
  }
};

async function runSemanticComparison(trialId, patientIds, res) {
  try {
    const result = await semanticComparisonService.getSemanticComparisonForTrial(
      trialId,
      patientIds
    );
    res.json({
      status: "OK",
      result,
    });
  } catch (error) {
    console.error("Semantic comparison failed:", error.message);
    res.status(error.statusCode || 500).json({
      status: "ERROR",
      message: error.message || "Semantic comparison failed.",
    });
  }
}

exports.getSemanticComparison = async (req, res) => {
  const { trialId, patientIds } = req.body;
  await runSemanticComparison(trialId, patientIds, res);
};

// GET variant so this can be smoke-tested straight from a browser URL bar or
// curl without needing a POST client. Unlike GET /semantic-criteria/:trialId
// (a plain DB read), this one is NOT free/read-only in effect: it makes a
// real OpenAI call per patient, sequentially, the same as the POST version.
// Nothing gets cached/stored, so there is no cheap "just show me what's
// already computed" path here yet. Defaults to only the first 2 patients
// when ?patientIds isn't given, so casual browsing doesn't accidentally run
// every seeded patient through a real OpenAI call. Not used by the Flutter app.
const DEFAULT_DEBUG_PATIENT_LIMIT = 2;

function parsePatientIdsQuery(raw) {
  return raw
    ? String(raw)
        .split(",")
        .map((id) => id.trim())
        .filter((id) => id.length > 0)
    : undefined;
}

const MATCH_NEXT_PATIENT_LIMIT = 10;

async function getPatientIdsForMatchingMode({ trialId, mode }) {
  const normalizedMode = mode === "all" ? "all" : "next";
  const limitSql = normalizedMode === "next" ? " LIMIT :limit" : "";
  const rows = await db.sequelize.query(
    `SELECT pr.id
     FROM patients_registration pr
     LEFT JOIN clinical_trial_match_results mr
       ON mr.patient_id = pr.id AND mr.trial_id = :trialId
     WHERE mr.patient_id IS NULL
     ORDER BY pr.id${limitSql}`,
    {
      replacements: {
        trialId,
        ...(limitSql ? { limit: MATCH_NEXT_PATIENT_LIMIT } : {}),
      },
      type: QueryTypes.SELECT,
    }
  );
  return rows.map((row) => row.id);
}

exports.getSemanticComparisonDebug = async (req, res) => {
  try {
    const patientIds =
      parsePatientIdsQuery(req.query.patientIds) ||
      (await semanticComparisonService.getDefaultDebugPatientIds(DEFAULT_DEBUG_PATIENT_LIMIT));
    await runSemanticComparison(req.params.trialId, patientIds, res);
  } catch (error) {
    console.error("Semantic comparison debug lookup failed:", error.message);
    res.status(error.statusCode || 500).json({
      status: "ERROR",
      message: error.message || "Semantic comparison debug lookup failed.",
    });
  }
};

exports.scoreEligibility = async (req, res) => {
  try {
    const { patients, totalSupplementalCriteriaCount } = req.body;
    const result = eligibilityScoringService.scoreEligibility(
      patients,
      totalSupplementalCriteriaCount
    );
    res.json({
      status: "OK",
      result,
    });
  } catch (error) {
    console.error("Eligibility scoring failed:", error.message);
    res.status(error.statusCode || 500).json({
      status: "ERROR",
      message: error.message || "Eligibility scoring failed.",
    });
  }
};

// Shared by the debug route and the real ranked-patients endpoint: runs
// deterministic matching (7) + semantic comparison (8) + eligibility
// scoring (9) for a trial and returns each patient's merged
// deterministicResult/semanticComparison/score/status/scoreBreakdown.
async function runScoredPipeline(trialId, patientIds) {
  const deterministicResult = await deterministicMatchingService.getStructuredMatchesForTrial(
    trialId,
    patientIds
  );
  const semanticResult = await semanticComparisonService.getSemanticComparisonForTrial(
    trialId,
    patientIds
  );
  const semanticByPatientId = new Map(
    semanticResult.patients.map((patient) => [patient.patientId, patient])
  );

  const scoringInput = deterministicResult.patients.map((patient) => ({
    patientId: patient.patientId,
    patientName: patient.patientName,
    deterministicResult: patient.deterministicResult,
    semanticComparison: semanticByPatientId.get(patient.patientId)?.semanticComparison,
  }));
  const { patients: scoredPatients } = eligibilityScoringService.scoreEligibility(
    scoringInput,
    semanticResult.totalSupplementalCriteriaCount
  );

  return {
    trialId: deterministicResult.trialId,
    patients: scoredPatients.map((scored) => ({
      ...scored,
      deterministicResult: scoringInput.find((p) => p.patientId === scored.patientId)
        ?.deterministicResult,
      semanticComparison: semanticByPatientId.get(scored.patientId)?.semanticComparison,
    })),
  };
}

// Debug convenience that chains deterministic matching (7) + semantic
// comparison (8) + eligibility scoring (9) for one trial, so the whole
// pipeline-so-far can be smoke-tested from a single URL. Like the semantic
// comparison debug route, this makes real OpenAI calls (one per patient,
// sequential) and is capped to a small default patient set unless
// ?patientIds is given. Not persisted to clinical_trial_match_results.
// Not used by the Flutter app - see getRankedPatients for the real endpoint.
exports.getFullMatchDebug = async (req, res) => {
  try {
    const { trialId } = req.params;
    const patientIds =
      parsePatientIdsQuery(req.query.patientIds) ||
      (await semanticComparisonService.getDefaultDebugPatientIds(DEFAULT_DEBUG_PATIENT_LIMIT));
    const result = await runScoredPipeline(trialId, patientIds);
    res.json({ status: "OK", result });
  } catch (error) {
    console.error("Full match debug failed:", error.message);
    res.status(error.statusCode || 500).json({
      status: "ERROR",
      message: error.message || "Full match debug failed.",
    });
  }
};

exports.explainRecommend = async (req, res) => {
  try {
    const { patients } = req.body;
    const result = await explanationService.generateExplanationsForPatients(patients || []);
    res.json({
      status: "OK",
      result,
    });
  } catch (error) {
    console.error("Explanation generation failed:", error.message);
    res.status(error.statusCode || 500).json({
      status: "ERROR",
      message: error.message || "Explanation generation failed.",
    });
  }
};

// The real ranked-patient dashboard endpoint: chains deterministic matching
// (7) + semantic comparison (8) + eligibility scoring (9) + explanation and
// recommendation (10) for every patient against one trial, then ranks by
// score. Unlike the debug routes, this has no patient-count cap by default -
// it is meant to run against the whole candidate pool, which means it makes
// two sequential OpenAI calls per patient (semantic comparison, then
// explanation) and can take a while for a large patient set. Results are
// persisted to clinical_trial_match_results so the dashboard can reload
// previously scored patients and future batches can skip them.
exports.getRankedPatients = async (req, res) => {
  try {
    const { trialId, patientIds, mode } = req.body;
    const explicitPatientIds = Array.isArray(patientIds) && patientIds.length > 0;
    const selectedPatientIds = explicitPatientIds
      ? patientIds
      : await getPatientIdsForMatchingMode({ trialId, mode });
    if (selectedPatientIds.length === 0) {
      return res.json({
        status: "OK",
        result: {
          trialId,
          mode: explicitPatientIds ? "explicit" : mode || "next",
          patientIds: [],
          patients: [],
          requestedCount: 0,
          matchedCount: 0,
          skippedCount: 0,
          failedCount: 0,
        },
      });
    }
    const scored = await runScoredPipeline(trialId, selectedPatientIds);
    const { patients: explained } = await explanationService.generateExplanationsForPatients(
      scored.patients
    );
    const explainedById = new Map(explained.map((patient) => [patient.patientId, patient]));

    const ranked = scored.patients
      .map((patient) => ({
        ...explainedById.get(patient.patientId),
        deterministicResult: patient.deterministicResult,
        semanticComparison: patient.semanticComparison,
        scoreBreakdown: patient.scoreBreakdown,
      }))
      .sort((a, b) => b.score - a.score)
      .map((patient, index) => ({ rank: index + 1, ...patient }));

    await matchResultService.saveMatchResults(scored.trialId, ranked);

    res.json({
      status: "OK",
      result: {
        trialId: scored.trialId,
        mode: explicitPatientIds ? "explicit" : mode || "next",
        patientIds: selectedPatientIds,
        patients: ranked,
        requestedCount: selectedPatientIds.length,
        matchedCount: ranked.length,
        skippedCount: 0,
        failedCount: selectedPatientIds.length - ranked.length,
      },
    });
  } catch (error) {
    console.error("Ranked patients failed:", error.message);
    res.status(error.statusCode || 500).json({
      status: "ERROR",
      message: error.message || "Ranked patients failed.",
    });
  }
};

exports.getStoredRankedPatients = async (req, res) => {
  try {
    const { trialId } = req.params;
    const patients = await matchResultService.getStoredMatchResults(trialId);
    res.json({
      status: "OK",
      result: {
        trialId,
        patientIds: patients.map((patient) => patient.patientId),
        patients,
      },
    });
  } catch (error) {
    console.error("Stored ranked patients lookup failed:", error.message);
    res.status(error.statusCode || 500).json({
      status: "ERROR",
      message: error.message || "Stored ranked patients lookup failed.",
    });
  }
};

exports.updateTrial = async (req, res) => {
  try {
    const result = await clinicalTrialUpdateService.updateClinicalTrial({
      formDataToSubmit: req.body.formDataToSubmit,
      companyInfo: req.body.companyInfo,
      semanticCriteria: req.body.semanticCriteria,
    });
    res.json({
      status: "OK",
      result,
    });
  } catch (error) {
    console.error("Updating clinical trial failed:", error.message);
    res.status(error.statusCode || 500).json({
      success: false,
      status: "ERROR",
      message: error.message || "Updating clinical trial failed.",
    });
  }
};

exports.deleteTrial = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  try {
    const { trialId } = req.body;
    if (trialId == null || trialId === "") {
      const error = new Error("trialId is required to delete a trial.");
      error.statusCode = 400;
      throw error;
    }

    const trials = await db.sequelize.query(
      "SELECT trial_id FROM clinical_trials WHERE trial_id = :trialId",
      {
        replacements: { trialId },
        type: QueryTypes.SELECT,
        transaction,
      }
    );
    if (trials.length === 0) {
      const error = new Error("Trial not found.");
      error.statusCode = 404;
      throw error;
    }

    const actionRows = await db.sequelize.query(
      "SELECT ActionID FROM clinicaltrials_actions WHERE TrialID = :trialId",
      {
        replacements: { trialId },
        type: QueryTypes.SELECT,
        transaction,
      }
    );
    const actionIds = actionRows.map((row) => row.ActionID);

    if (actionIds.length > 0) {
      await db.sequelize.query(
        "DELETE FROM clinicaltrials_actionresponses WHERE ActionID IN (:actionIds)",
        { replacements: { actionIds }, type: QueryTypes.DELETE, transaction }
      );
      await db.sequelize.query(
        "DELETE FROM clinicaltrials_actionrequests WHERE ActionID IN (:actionIds)",
        { replacements: { actionIds }, type: QueryTypes.DELETE, transaction }
      );
      await db.sequelize.query(
        "DELETE FROM clinicaltrials_actions WHERE ActionID IN (:actionIds)",
        { replacements: { actionIds }, type: QueryTypes.DELETE, transaction }
      );
    }

    const deleteStatements = [
      "DELETE FROM clinical_trial_match_results WHERE trial_id = :trialId",
      "DELETE FROM clinical_trial_semantic_criteria WHERE trial_id = :trialId",
      "DELETE FROM clinicaltrials_patients WHERE trial_id = :trialId",
      "DELETE FROM clinical_trials_contacts WHERE trial_id = :trialId",
      "DELETE FROM clinical_trials WHERE trial_id = :trialId",
    ];

    for (const statement of deleteStatements) {
      await db.sequelize.query(statement, {
        replacements: { trialId },
        type: QueryTypes.DELETE,
        transaction,
      });
    }

    await transaction.commit();
    res.json({
      status: "OK",
      result: { trialId },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Deleting clinical trial failed:", error.message);
    res.status(error.statusCode || 500).json({
      status: "ERROR",
      message: error.message || "Deleting clinical trial failed.",
    });
  }
};
