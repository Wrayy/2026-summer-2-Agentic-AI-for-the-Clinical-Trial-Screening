const db = require("../../db");
const { QueryTypes } = require("sequelize");
const semanticComparisonAgent = require("./agents/semanticComparisonAgent");
const semanticCriteriaService = require("./semanticCriteriaService");

async function loadTrial(trialId) {
  const trials = await db.sequelize.query(
    "SELECT * FROM clinical_trials WHERE trial_id = :trial_id",
    { replacements: { trial_id: trialId }, type: QueryTypes.SELECT }
  );
  const trial = trials[0];
  if (!trial) {
    const error = new Error("Trial not found");
    error.statusCode = 404;
    throw error;
  }
  return trial;
}

async function loadPatients(patientIds) {
  const patientFilterSql =
    Array.isArray(patientIds) && patientIds.length > 0 ? " WHERE id IN (:patientIds)" : "";
  const patients = await db.sequelize.query(
    `SELECT * FROM patients_registration${patientFilterSql}`,
    {
      replacements: patientFilterSql ? { patientIds } : {},
      type: QueryTypes.SELECT,
    }
  );
  const patientPathologies = await db.sequelize.query(
    "SELECT * FROM patients_pathology",
    { type: QueryTypes.SELECT }
  );
  const pathologyClassifications = await db.sequelize.query(
    "SELECT * FROM pathology_classifications",
    { type: QueryTypes.SELECT }
  );
  const pathologyToClassification = pathologyClassifications.reduce((acc, row) => {
    if (row.Pathology && row.Classification) {
      acc[String(row.Pathology).trim().toLowerCase()] = String(row.Classification).trim();
    }
    return acc;
  }, {});

  return patients.map((patient) => ({
    patient,
    pathology: patientPathologies.find((pp) => pp.patient_id === patient.id) || {},
    pathologyToClassification,
  }));
}

function parseExclusionCriteria(trial) {
  try {
    return typeof trial.exclusion_criteria === "string"
      ? JSON.parse(trial.exclusion_criteria)
      : trial.exclusion_criteria || {};
  } catch (error) {
    return {};
  }
}

function medicationExclusions(exclusionCriteria) {
  return (
    exclusionCriteria.PriorMedications ||
    exclusionCriteria["Prior Medications"] ||
    null
  );
}

function splitClinicalList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function patientClassifications(pathologyText, pathologyToClassification) {
  return Array.from(
    new Set(
      splitClinicalList(pathologyText)
        .map((item) => pathologyToClassification[item.toLowerCase()])
        .filter(Boolean)
    )
  );
}

function buildTrialContext(trial, semanticCriteria) {
  const criteriaJson =
    semanticCriteria &&
    (typeof semanticCriteria.criteria_json === "string"
      ? JSON.parse(semanticCriteria.criteria_json)
      : semanticCriteria.criteria_json || {});

  const exclusionCriteria = parseExclusionCriteria(trial);
  const semanticClinicalCriteria = [
    trial.related_conditions && {
      category: "Related Conditions",
      criterion: trial.related_conditions,
    },
    trial.pathology && {
      category: "Pathology / Target Condition",
      criterion: trial.pathology,
    },
    exclusionCriteria.Diseases && {
      category: "Disease Exclusions",
      criterion: exclusionCriteria.Diseases,
    },
    exclusionCriteria.Surgeries && {
      category: "Surgery Exclusions",
      criterion: exclusionCriteria.Surgeries,
    },
    medicationExclusions(exclusionCriteria) && {
      category: "Medication Exclusions",
      criterion: medicationExclusions(exclusionCriteria),
    },
  ].filter(Boolean);

  return {
    trialName: trial.trial_name,
    gender: trial.gender,
    ageRange: trial.age_range,
    bmiRange: exclusionCriteria.BMI || null,
    pregnancyExclusion: exclusionCriteria.Pregnancy || null,
    semanticClinicalCriteria,
    supplementalSummary: semanticCriteria ? semanticCriteria.summary : null,
    additionalTrialInformation: criteriaJson?.additionalTrialInformation || [],
  };
}

function buildPatientContext({ pathology, pathologyToClassification }) {
  return {
    diagnosis: pathology.pathology || null,
    diagnosisClassifications: patientClassifications(
      pathology.pathology,
      pathologyToClassification
    ),
    medications: pathology.prior_medication || null,
    surgeries: pathology.surgeries || null,
    pregnancies: pathology.pregnancies ?? null,
    medicalHistory: pathology.medical_history || null,
    otherNotes: pathology.other_notes || null,
  };
}

// Used by the GET debug route's default (no ?patientIds given), so casual
// manual testing doesn't accidentally run every seeded patient through a
// real OpenAI call. The POST endpoint's real default (all patients) is
// untouched - this only affects the debug convenience path.
async function getDefaultDebugPatientIds(limit) {
  const rows = await db.sequelize.query(
    "SELECT id FROM patients_registration ORDER BY id LIMIT :limit",
    { replacements: { limit }, type: QueryTypes.SELECT }
  );
  return rows.map((row) => row.id);
}

async function getSemanticComparisonForTrial(trialId, patientIds) {
  if (trialId == null || trialId === "") {
    const error = new Error("trialId is required for semantic comparison.");
    error.statusCode = 400;
    throw error;
  }

  const trial = await loadTrial(trialId);
  const semanticCriteria = await semanticCriteriaService.getSemanticCriteria(trialId);
  if (!semanticCriteria) {
    const error = new Error(
      `No supplemental criteria saved for trial ${trialId} yet. Extract and save supplemental criteria (POST /save-semantic-criteria) before running semantic comparison.`
    );
    error.statusCode = 400;
    throw error;
  }

  const trialContext = buildTrialContext(trial, semanticCriteria);
  const patientRecords = await loadPatients(patientIds);

  const patients = [];
  for (const record of patientRecords) {
    const { patient } = record;
    const patientFullName = `${patient.FName} ${
      patient.MName ? patient.MName + " " : ""
    }${patient.LName}`.trim();

    try {
      const semanticComparison = await semanticComparisonAgent.compareTrialToPatient(
        trialContext,
        buildPatientContext(record)
      );
      patients.push({ patientId: patient.id, patientName: patientFullName, semanticComparison });
    } catch (error) {
      console.error(
        `Semantic comparison failed for patient_id=${patient.id}, trial_id=${trialId}:`,
        error.message
      );
      patients.push({
        patientId: patient.id,
        patientName: patientFullName,
        semanticComparison: {
          summary: "",
          supportingFactors: [],
          potentialConflicts: [],
          missingInformation: [],
          concerns: [],
          error: error.message,
        },
      });
    }
  }

  return {
    trialId: trial.trial_id,
    patients,
    totalSupplementalCriteriaCount:
      trialContext.semanticClinicalCriteria.length +
      trialContext.additionalTrialInformation.length,
  };
}

module.exports = {
  getSemanticComparisonForTrial,
  getDefaultDebugPatientIds,
};
