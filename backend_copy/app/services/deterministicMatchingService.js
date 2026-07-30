const db = require("../../db");
const { QueryTypes } = require("sequelize");

// Structured re-implementation of the inclusion/exclusion rules used by
// userController.getSingleClinicalTrialsMatchedPatients. Kept isolated from
// userController.js so existing matched-patient endpoints are untouched;
// this version returns matched/failed/missing fields and hard exclusion
// flags per patient instead of a single pass/fail boolean, so later scoring
// and explanation agents have something structured to consume.

function parseAgeRange(ageRange) {
  const text = String(ageRange || "").trim();
  if (!text) return null;

  // A trial may specify only one bound. Trial documents commonly state a
  // minimum age with no maximum, which arrives here as "18-". An empty bound
  // must be treated as unbounded, not as zero -- Number("") is 0, so parsing
  // both halves numerically would silently turn "18-" into the impossible
  // range 18..0 and hard-exclude every patient.
  const [lowerText = "", upperText = ""] = text.split("-");
  const lowerBound = lowerText.trim() === "" ? null : Number(lowerText);
  const upperBound = upperText.trim() === "" ? null : Number(upperText);

  if (lowerBound !== null && Number.isNaN(lowerBound)) return null;
  if (upperBound !== null && Number.isNaN(upperBound)) return null;
  if (lowerBound === null && upperBound === null) return null;

  return { lowerBound, upperBound };
}

function isAgeInRange(age, ageRange) {
  const allowedRange = parseAgeRange(ageRange);
  if (!allowedRange) return false;

  const numericAge = Number(age);
  if (Number.isNaN(numericAge)) return false;

  const belowMinimum =
    allowedRange.lowerBound != null && numericAge < allowedRange.lowerBound;
  const aboveMaximum =
    allowedRange.upperBound != null && numericAge > allowedRange.upperBound;

  return !belowMinimum && !aboveMaximum;
}

function calculateBMI(weight, height) {
  const heightInMeters = height / 100;
  if (!heightInMeters) return null;
  return weight / heightInMeters ** 2;
}

function formatValue(value, fallback = "Not Available") {
  return isEmpty(value) ? fallback : String(value);
}

function formatBmi(value) {
  return Number.isFinite(value) ? value.toFixed(1) : "Not Available";
}

function addCriteriaDetail(result, field, criterion, patientData, outcome) {
  result.criteriaDetails.push({
    field,
    criterion,
    patientData,
    outcome,
  });
}

function parseAllowedBmiRange(bmiCriteria) {
  const text = String(bmiCriteria || "").trim();
  if (!text) return null;

  const numbers = text.match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
  if (numbers.length >= 2) {
    return {
      lowerBound: Math.min(numbers[0], numbers[1]),
      upperBound: Math.max(numbers[0], numbers[1]),
    };
  }

  if (numbers.length === 1) {
    if (text.includes(">")) {
      return { lowerBound: numbers[0], upperBound: null };
    }
    if (text.includes("<")) {
      return { lowerBound: null, upperBound: numbers[0] };
    }
  }

  return null;
}

function isGenderMatch(trialGender, patientGender) {
  return trialGender === "Both" || trialGender === patientGender;
}

function isEmpty(value) {
  return value === null || value === undefined || value === "";
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

function evaluateBmi(exclusionCriteria, patient, result) {
  const bmiCriteria = exclusionCriteria.BMI || "";
  if (!bmiCriteria) {
    addCriteriaDetail(
      result,
      "bmi",
      "No allowed BMI range specified",
      "Not Applicable",
      "Not Applicable"
    );
    return;
  }

  if (isEmpty(patient.height) || isEmpty(patient.weight)) {
    result.missingFields.push("bmi");
    addCriteriaDetail(
      result,
      "bmi",
      `Allowed BMI range: ${bmiCriteria}`,
      `Height: ${formatValue(patient.height)}, Weight: ${formatValue(patient.weight)}`,
      "Missing"
    );
    return;
  }

  const patientBMI = calculateBMI(patient.weight, patient.height);
  const allowedRange = parseAllowedBmiRange(bmiCriteria);
  if (!allowedRange) {
    result.missingFields.push("bmi");
    addCriteriaDetail(
      result,
      "bmi",
      `Allowed BMI range: ${bmiCriteria}`,
      `BMI: ${formatBmi(patientBMI)}`,
      "Missing"
    );
    return;
  }

  const belowMinimum =
    allowedRange.lowerBound != null && patientBMI < allowedRange.lowerBound;
  const aboveMaximum =
    allowedRange.upperBound != null && patientBMI > allowedRange.upperBound;

  if (belowMinimum || aboveMaximum) {
    result.hardExclusionFlags.push("bmi");
    result.failedFields.push("bmi");
    addCriteriaDetail(
      result,
      "bmi",
      `Allowed BMI range: ${bmiCriteria}`,
      `BMI: ${formatBmi(patientBMI)}`,
      "Failed"
    );
  } else {
    result.matchedFields.push("bmi");
    addCriteriaDetail(
      result,
      "bmi",
      `Allowed BMI range: ${bmiCriteria}`,
      `BMI: ${formatBmi(patientBMI)}`,
      "Matched"
    );
  }
}

function evaluatePregnancyExclusion({ exclusionCriteria, patientPathology, result }) {
  if (exclusionCriteria.Pregnancy !== "Yes") {
    const pregnancyData = isEmpty(patientPathology.pregnancies)
      ? "Pregnancy history not evaluated"
      : `Pregnancies: ${patientPathology.pregnancies}`;
    addCriteriaDetail(
      result,
      "pregnancy",
      `Pregnancy exclusion: ${formatValue(exclusionCriteria.Pregnancy, "Unrestricted")}`,
      pregnancyData,
      "Not Applicable"
    );
    return;
  }
  if (isEmpty(patientPathology.pregnancies)) {
    result.missingFields.push("pregnancy");
    addCriteriaDetail(
      result,
      "pregnancy",
      "Pregnancy exclusion: Yes",
      "Pregnancy history unavailable",
      "Missing"
    );
    return;
  }

  const excluded = Number(patientPathology.pregnancies) > 0;
  if (excluded) {
    result.hardExclusionFlags.push("pregnancy");
    result.failedFields.push("pregnancy");
    addCriteriaDetail(
      result,
      "pregnancy",
      "Pregnancy exclusion: Yes",
      `Pregnancies: ${patientPathology.pregnancies}`,
      "Failed"
    );
  } else {
    result.matchedFields.push("pregnancy");
    addCriteriaDetail(
      result,
      "pregnancy",
      "Pregnancy exclusion: Yes",
      `Pregnancies: ${patientPathology.pregnancies}`,
      "Matched"
    );
  }
}

function evaluatePatientAgainstTrial(trial, patient, patientPathology) {
  const result = {
    passed: false,
    matchedFields: [],
    failedFields: [],
    missingFields: [],
    hardExclusionFlags: [],
    criteriaDetails: [],
  };

  // Deterministic criteria are intentionally limited to objective fields that
  // line up cleanly between trial and patient records. Multi-value clinical
  // text fields (pathology, related conditions, diseases, surgeries, and
  // medication exclusions) are compared semantically instead.
  if (trial.gender) {
    if (isEmpty(patient.Gender)) {
      result.missingFields.push("gender");
      addCriteriaDetail(
        result,
        "gender",
        `Required gender: ${trial.gender}`,
        "Gender unavailable",
        "Missing"
      );
    } else if (isGenderMatch(trial.gender, patient.Gender)) {
      result.matchedFields.push("gender");
      addCriteriaDetail(
        result,
        "gender",
        `Required gender: ${trial.gender}`,
        `Gender: ${patient.Gender}`,
        "Matched"
      );
    } else {
      result.hardExclusionFlags.push("gender");
      result.failedFields.push("gender");
      addCriteriaDetail(
        result,
        "gender",
        `Required gender: ${trial.gender}`,
        `Gender: ${patient.Gender}`,
        "Failed"
      );
    }
  }

  if (trial.age_range) {
    if (isEmpty(patient.Age)) {
      result.missingFields.push("age");
      addCriteriaDetail(
        result,
        "age",
        `Required age range: ${trial.age_range}`,
        "Age unavailable",
        "Missing"
      );
    } else if (!parseAgeRange(trial.age_range)) {
      // An unreadable trial age range is missing information, not evidence
      // that the patient fails. Treating it as a hard exclusion would mark
      // every patient Not Eligible because of a data-entry problem.
      result.missingFields.push("age");
      addCriteriaDetail(
        result,
        "age",
        `Required age range: ${trial.age_range}`,
        `Age: ${patient.Age}`,
        "Missing"
      );
    } else if (isAgeInRange(patient.Age, trial.age_range)) {
      result.matchedFields.push("age");
      addCriteriaDetail(
        result,
        "age",
        `Required age range: ${trial.age_range}`,
        `Age: ${patient.Age}`,
        "Matched"
      );
    } else {
      result.hardExclusionFlags.push("age");
      result.failedFields.push("age");
      addCriteriaDetail(
        result,
        "age",
        `Required age range: ${trial.age_range}`,
        `Age: ${patient.Age}`,
        "Failed"
      );
    }
  }

  // Exclusion criteria
  const exclusionCriteria = parseExclusionCriteria(trial);
  evaluateBmi(exclusionCriteria, patient, result);
  evaluatePregnancyExclusion({ exclusionCriteria, patientPathology, result });

  result.passed = result.failedFields.length === 0 && result.hardExclusionFlags.length === 0;
  return result;
}

async function getStructuredMatchesForTrial(trialId, patientIds) {
  if (trialId == null || trialId === "") {
    const error = new Error("trialId is required for deterministic matching.");
    error.statusCode = 400;
    throw error;
  }

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

  const patientFilterSql =
    Array.isArray(patientIds) && patientIds.length > 0
      ? " WHERE id IN (:patientIds)"
      : "";
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

  const patients_result = patients.map((patient) => {
    const patientPathology =
      patientPathologies.find((pp) => pp.patient_id === patient.id) || {};
    const patientFullName = `${patient.FName} ${
      patient.MName ? patient.MName + " " : ""
    }${patient.LName}`.trim();

    return {
      patientId: patient.id,
      patientName: patientFullName,
      deterministicResult: evaluatePatientAgainstTrial(
        trial,
        patient,
        patientPathology
      ),
    };
  });

  return { trialId: trial.trial_id, patients: patients_result };
}

module.exports = {
  evaluatePatientAgainstTrial,
  getStructuredMatchesForTrial,
};
