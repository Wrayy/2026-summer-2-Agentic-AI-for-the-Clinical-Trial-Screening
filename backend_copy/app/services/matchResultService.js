const db = require("../../db");
const { QueryTypes } = require("sequelize");

function jsonOrNull(value) {
  if (value === undefined || value === null) return null;
  return JSON.stringify(value);
}

function parseJson(value, fallback) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
}

function toNumberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toStoredExplanation(patient) {
  return {
    patientName: patient.patientName || `Patient ${patient.patientId}`,
    primaryAction: patient.primaryAction || null,
    explanation: patient.explanation || "",
    scoreBreakdown: patient.scoreBreakdown || {},
    error: patient.error || null,
  };
}

function rowToPatient(row) {
  const explanation = parseJson(row.explanation_json, {});
  const suggestedActions = parseJson(row.suggested_actions_json, []);
  const patient = {
    patientId: row.patient_id,
    patientName: explanation.patientName || `Patient ${row.patient_id}`,
    score: toNumberOrNull(row.score) || 0,
    status: row.status || "Needs Review",
    primaryAction: explanation.primaryAction || "Review Candidate",
    explanation: explanation.explanation || "",
    suggestedActions: Array.isArray(suggestedActions) ? suggestedActions : [],
    deterministicResult: parseJson(row.deterministic_result_json, {}),
    semanticComparison: parseJson(row.semantic_result_json, {}),
    scoreBreakdown: explanation.scoreBreakdown || {},
    lastEvaluatedAt: row.last_evaluated_at,
  };
  if (explanation.error) patient.error = explanation.error;
  return patient;
}

function rankPatients(patients) {
  return patients
    .slice()
    .sort((a, b) => {
      const scoreDiff = (b.score || 0) - (a.score || 0);
      return scoreDiff !== 0 ? scoreDiff : a.patientId - b.patientId;
    })
    .map((patient, index) => ({ rank: index + 1, ...patient }));
}

async function getStoredMatchResults(trialId) {
  const rows = await db.sequelize.query(
    `SELECT
       patient_id,
       deterministic_result_json,
       semantic_result_json,
       score,
       status,
       explanation_json,
       suggested_actions_json,
       last_evaluated_at
     FROM clinical_trial_match_results
     WHERE trial_id = :trialId`,
    {
      replacements: { trialId },
      type: QueryTypes.SELECT,
    }
  );
  return rankPatients(rows.map(rowToPatient));
}

async function saveMatchResults(trialId, patients) {
  for (const patient of patients) {
    await db.sequelize.query(
      `INSERT INTO clinical_trial_match_results (
         trial_id,
         patient_id,
         deterministic_result_json,
         semantic_result_json,
         score,
         status,
         explanation_json,
         suggested_actions_json,
         last_evaluated_at
       )
       VALUES (
         :trialId,
         :patientId,
         :deterministicResult,
         :semanticComparison,
         :score,
         :status,
         :explanation,
         :suggestedActions,
         NOW()
       )
       ON DUPLICATE KEY UPDATE
         deterministic_result_json = VALUES(deterministic_result_json),
         semantic_result_json = VALUES(semantic_result_json),
         score = VALUES(score),
         status = VALUES(status),
         explanation_json = VALUES(explanation_json),
         suggested_actions_json = VALUES(suggested_actions_json),
         last_evaluated_at = VALUES(last_evaluated_at)`,
      {
        replacements: {
          trialId,
          patientId: patient.patientId,
          deterministicResult: jsonOrNull(patient.deterministicResult),
          semanticComparison: jsonOrNull(patient.semanticComparison),
          score: toNumberOrNull(patient.score),
          status: patient.status || "Needs Review",
          explanation: jsonOrNull(toStoredExplanation(patient)),
          suggestedActions: jsonOrNull(patient.suggestedActions || []),
        },
        type: QueryTypes.INSERT,
      }
    );
  }
}

async function clearMatchResultsForTrial(trialId, options = {}) {
  const countRows = await db.sequelize.query(
    `SELECT COUNT(*) AS resultCount
     FROM clinical_trial_match_results
     WHERE trial_id = :trialId`,
    {
      replacements: { trialId },
      type: QueryTypes.SELECT,
      transaction: options.transaction,
    }
  );
  const resultCount = Number(countRows[0]?.resultCount) || 0;

  await db.sequelize.query(
    `DELETE FROM clinical_trial_match_results
     WHERE trial_id = :trialId`,
    {
      replacements: { trialId },
      type: QueryTypes.DELETE,
      transaction: options.transaction,
    }
  );

  return resultCount;
}

module.exports = {
  clearMatchResultsForTrial,
  getStoredMatchResults,
  saveMatchResults,
};
