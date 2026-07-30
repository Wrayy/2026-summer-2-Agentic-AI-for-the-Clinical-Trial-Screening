const db = require("../../db");
const { QueryTypes } = require("sequelize");

async function saveSemanticCriteria({
  trialId,
  additionalTrialInformation,
  summary,
  missingOrAmbiguousCriteria,
  sourceType = "supplemental_agent",
}, options = {}) {
  if (trialId == null || trialId === "") {
    const error = new Error("trialId is required to save semantic criteria.");
    error.statusCode = 400;
    throw error;
  }

  const criteriaJson = JSON.stringify({
    additionalTrialInformation: additionalTrialInformation || [],
    missingOrAmbiguousCriteria: missingOrAmbiguousCriteria || [],
  });

  const upsertSql = `
    INSERT INTO clinical_trial_semantic_criteria (trial_id, source_type, criteria_json, summary)
    VALUES (:trialId, :sourceType, :criteriaJson, :summary)
    ON DUPLICATE KEY UPDATE
      source_type = VALUES(source_type),
      criteria_json = VALUES(criteria_json),
      summary = VALUES(summary),
      updated_at = CURRENT_TIMESTAMP
  `;

  await db.sequelize.query(upsertSql, {
    replacements: {
      trialId,
      sourceType,
      criteriaJson,
      summary: summary || "",
    },
    type: QueryTypes.INSERT,
    transaction: options.transaction,
  });

  console.log(`Saved semantic criteria for trial_id=${trialId} (source_type=${sourceType}).`);

  return { trialId, sourceType };
}

async function getSemanticCriteria(trialId, options = {}) {
  if (trialId == null || trialId === "") {
    const error = new Error("trialId is required to fetch semantic criteria.");
    error.statusCode = 400;
    throw error;
  }

  const rows = await db.sequelize.query(
    "SELECT * FROM clinical_trial_semantic_criteria WHERE trial_id = :trialId",
    {
      replacements: { trialId },
      type: QueryTypes.SELECT,
      transaction: options.transaction,
    }
  );

  return rows[0] || null;
}

module.exports = {
  saveSemanticCriteria,
  getSemanticCriteria,
};
