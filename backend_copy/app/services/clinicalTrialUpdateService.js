const db = require("../../db");
const { QueryTypes } = require("sequelize");
const matchResultService = require("./matchResultService");
const semanticCriteriaService = require("./semanticCriteriaService");
const {
  criteriaSnapshotFromIncoming,
  criteriaSnapshotFromStored,
  hasCriteriaChanged,
  semanticRowFromPayload,
} = require("./trialCriteriaComparisonService");

function parseTrialId(value) {
  const text = value == null ? "" : String(value).trim();
  if (!/^\d+$/.test(text)) return null;
  const numeric = Number(text);
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null;
}

function optionalText(value) {
  return value == null ? "" : String(value);
}

function optionalNullableText(value) {
  const text = optionalText(value).trim();
  return text === "" ? null : text;
}

function formatDateOrNull(value, fieldName) {
  const text = optionalText(value).trim();
  if (text === "") return null;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    const error = new Error(`${fieldName} must be a valid date.`);
    error.statusCode = 400;
    throw error;
  }
  return parsed.toISOString().split("T")[0];
}

function combineMasking(masking, maskingDetails) {
  const maskingText = optionalText(masking).trim();
  if (
    maskingText === "" ||
    maskingText === "None (Open Label)" ||
    maskingText.toLowerCase() === "open label" ||
    maskingText.toLowerCase() === "open-label"
  ) {
    return "None (Open Label)";
  }

  const details =
    maskingDetails && typeof maskingDetails === "object" ? maskingDetails : {};
  const roles = Object.keys(details)
    .filter((key) => details[key])
    .join(", ");
  return roles ? `${maskingText} (${roles})` : maskingText;
}

function buildLocation(region, country) {
  const regionText = optionalText(region).trim();
  const countryText = optionalText(country).trim();
  return [regionText, countryText].filter(Boolean).join(", ");
}

function buildTrialUpdateValues(formData) {
  return {
    trialName: optionalText(formData.trialName),
    officialTitle: optionalText(formData.officialTitle),
    briefSummary: optionalText(formData.briefSummary),
    detailedDescription: optionalText(formData.detailedDescription),
    relatedConditions: optionalText(formData.relatedConditions),
    startDate: formatDateOrNull(formData.startDate, "startDate"),
    endDate: formatDateOrNull(formData.endDate, "endDate"),
    primaryPurpose: optionalText(formData.primaryPurpose),
    trialPhase: optionalText(formData.trialPhase),
    studyType: optionalText(formData.studyType),
    allocation: optionalText(formData.allocation),
    interventionModel: optionalText(formData.interventionModel),
    masking: combineMasking(formData.masking, formData.maskingDetails),
    sponsor: optionalText(formData.sponsor),
    principalInvestigator: optionalText(formData.principalInvestigator),
    pathology: optionalText(formData.pathology).trim(),
    ageRange: optionalText(formData.ageRange),
    gender: optionalText(formData.gender),
    exclusionCriteria: JSON.stringify({
      BMI: optionalText(formData.bmi),
      Diseases: optionalText(formData.diseases).trim(),
      Surgeries: optionalText(formData.surgeries).trim(),
      PriorMedications: optionalText(formData.priorMedications),
      Pregnancy: optionalText(formData.pregnancy),
    }),
    locations: buildLocation(formData.region, formData.country),
    ethicsApproval: optionalText(formData.ethicsApproval),
  };
}

function buildContactValues(formData, trialId) {
  return {
    trialId,
    firstName: optionalNullableText(formData.firstName),
    middleName: optionalNullableText(formData.middleName),
    lastName: optionalNullableText(formData.lastName),
    areaCode: optionalNullableText(formData.phone),
    phoneNumber: optionalNullableText(formData.phoneNumber),
    email: optionalNullableText(formData.email),
  };
}

async function loadExistingTrial(trialId, companyId, transaction) {
  const companySql = companyId != null ? " AND company_id = :companyId" : "";
  const trials = await db.sequelize.query(
    `
    SELECT *
    FROM clinical_trials
    WHERE trial_id = :trialId${companySql}
    FOR UPDATE
    `,
    {
      replacements: {
        trialId,
        ...(companyId != null ? { companyId } : {}),
      },
      type: QueryTypes.SELECT,
      transaction,
    }
  );
  return trials[0] || null;
}

async function updateContact(formData, trialId, transaction) {
  const contactValues = buildContactValues(formData, trialId);
  const contacts = await db.sequelize.query(
    `
    SELECT id
    FROM clinical_trials_contacts
    WHERE trial_id = :trialId
    ORDER BY id
    LIMIT 1
    FOR UPDATE
    `,
    {
      replacements: { trialId },
      type: QueryTypes.SELECT,
      transaction,
    }
  );

  if (contacts.length > 0) {
    await db.sequelize.query(
      `
      UPDATE clinical_trials_contacts
      SET first_name = :firstName,
          middle_name = :middleName,
          last_name = :lastName,
          area_code = :areaCode,
          phone_number = :phoneNumber,
          email = :email
      WHERE id = :contactId
      `,
      {
        replacements: {
          ...contactValues,
          contactId: contacts[0].id,
        },
        type: QueryTypes.UPDATE,
        transaction,
      }
    );
    return;
  }

  await db.sequelize.query(
    `
    INSERT INTO clinical_trials_contacts (
      trial_id,
      first_name,
      middle_name,
      last_name,
      area_code,
      phone_number,
      email
    )
    VALUES (
      :trialId,
      :firstName,
      :middleName,
      :lastName,
      :areaCode,
      :phoneNumber,
      :email
    )
    `,
    {
      replacements: contactValues,
      type: QueryTypes.INSERT,
      transaction,
    }
  );
}

async function updateTrialRow(formData, trialId, transaction) {
  const values = buildTrialUpdateValues(formData);
  await db.sequelize.query(
    `
    UPDATE clinical_trials
    SET trial_name = :trialName,
        official_title = :officialTitle,
        brief_summary = :briefSummary,
        detailed_description = :detailedDescription,
        related_conditions = :relatedConditions,
        trial_phase = :trialPhase,
        study_type = :studyType,
        allocation = :allocation,
        intervention_model = :interventionModel,
        masking = :masking,
        primary_purpose = :primaryPurpose,
        locations = :locations,
        principal_investigator = :principalInvestigator,
        sponsor = :sponsor,
        ethics_approval = :ethicsApproval,
        pathology = :pathology,
        age_range = :ageRange,
        gender = :gender,
        exclusion_criteria = :exclusionCriteria,
        start_date = :startDate,
        end_date = :endDate
    WHERE trial_id = :trialId
    `,
    {
      replacements: {
        ...values,
        trialId,
      },
      type: QueryTypes.UPDATE,
      transaction,
    }
  );
}

async function updateClinicalTrial({
  formDataToSubmit,
  companyInfo,
  semanticCriteria,
}) {
  const formData = formDataToSubmit || {};
  const trialId = parseTrialId(formData.trialId);
  if (trialId == null) {
    const error = new Error("Invalid trialId");
    error.statusCode = 400;
    throw error;
  }

  const companyId =
    companyInfo && companyInfo.id != null ? Number(companyInfo.id) : null;
  if (companyInfo && companyInfo.id != null && !Number.isFinite(companyId)) {
    const error = new Error("Invalid company id");
    error.statusCode = 400;
    throw error;
  }
  const transaction = await db.sequelize.transaction();

  try {
    const existingTrial = await loadExistingTrial(
      trialId,
      companyId,
      transaction
    );
    if (!existingTrial) {
      const error = new Error("Clinical trial was not found.");
      error.statusCode = 404;
      throw error;
    }

    const existingSemanticCriteria =
      await semanticCriteriaService.getSemanticCriteria(trialId, {
        transaction,
      });
    const incomingSemanticCriteria =
      semanticCriteria && semanticCriteria.changed === true
        ? semanticRowFromPayload(trialId, semanticCriteria)
        : existingSemanticCriteria;

    const oldSnapshot = criteriaSnapshotFromStored(
      existingTrial,
      existingSemanticCriteria
    );
    const nextSnapshot = criteriaSnapshotFromIncoming(
      formData,
      incomingSemanticCriteria
    );
    const criteriaChanged = hasCriteriaChanged(oldSnapshot, nextSnapshot);

    await updateContact(formData, trialId, transaction);
    await updateTrialRow(formData, trialId, transaction);

    if (semanticCriteria && semanticCriteria.changed === true) {
      await semanticCriteriaService.saveSemanticCriteria(
        {
          trialId,
          additionalTrialInformation:
            semanticCriteria.additionalTrialInformation || [],
          summary: semanticCriteria.summary || "",
          missingOrAmbiguousCriteria:
            semanticCriteria.missingOrAmbiguousCriteria || [],
          sourceType: semanticCriteria.sourceType || "manual_form",
        },
        { transaction }
      );
    }

    const clearedRankedResultCount = criteriaChanged
      ? await matchResultService.clearMatchResultsForTrial(trialId, {
          transaction,
        })
      : 0;

    await transaction.commit();
    return {
      success: true,
      trialId,
      criteriaChanged,
      clearedRankedResultCount,
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

module.exports = {
  buildTrialUpdateValues,
  combineMasking,
  parseTrialId,
  updateClinicalTrial,
};
