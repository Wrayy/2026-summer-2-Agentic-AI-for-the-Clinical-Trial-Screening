const assert = require("assert");
const {
  criteriaSnapshotFromIncoming,
  criteriaSnapshotFromStored,
  hasCriteriaChanged,
  semanticRowFromPayload,
} = require("../app/services/trialCriteriaComparisonService");

function changed(oldTrial, oldSemantic, formData, nextSemantic = oldSemantic) {
  return hasCriteriaChanged(
    criteriaSnapshotFromStored(oldTrial, oldSemantic),
    criteriaSnapshotFromIncoming(formData, nextSemantic)
  );
}

const oldTrial = {
  related_conditions: "Hypertension, Cardiovascular Disease",
  pathology: " Hypertension ",
  age_range: "40-75",
  gender: "Both",
  exclusion_criteria: JSON.stringify({
    BMI: "> 18 and < 35",
    Diseases: "Renal Disease",
    Surgeries: "Recent abdominal surgery",
    "Prior Medications": "Warfarin",
    Pregnancy: "Yes",
  }),
};

const oldSemantic = {
  source_type: "supplemental_agent",
  summary: "Stable medications required.",
  criteria_json: JSON.stringify({
    missingOrAmbiguousCriteria: ["Lab threshold timing unclear"],
    additionalTrialInformation: [
      {
        criterion: "Stable antihypertensive regimen for 4 weeks",
        category: "Medication stability",
        relevance: "High",
      },
    ],
  }),
};

const baseForm = {
  relatedConditions: " cardiovascular disease ; hypertension ",
  pathology: "hypertension",
  ageRange: "40 - 75",
  gender: "both",
  bmi: ">18 or <35",
  diseases: "renal disease",
  surgeries: "recent abdominal surgery",
  priorMedications: "warfarin",
  pregnancy: "Yes",
};

assert.strictEqual(
  changed(oldTrial, oldSemantic, baseForm),
  false,
  "formatting and compatible medication keys should not change criteria"
);

assert.strictEqual(
  changed(oldTrial, oldSemantic, {
    ...baseForm,
    firstName: "New",
    lastName: "Contact",
    phoneNumber: "5551212",
    email: "updated@example.test",
  }),
  false,
  "contact-information-only changes should not change criteria"
);

assert.strictEqual(
  changed(oldTrial, oldSemantic, {
    ...baseForm,
    trialName: "Updated General Trial Name",
    briefSummary: "Updated summary",
    detailedDescription: "Updated description",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    masking: "Double",
    region: "Ontario",
    country: "Canada",
  }),
  false,
  "general trial-information-only changes should not change criteria"
);

assert.strictEqual(
  changed(oldTrial, oldSemantic, { ...baseForm, ageRange: "45-75" }),
  true,
  "age range changes should be criteria-relevant"
);

assert.strictEqual(
  changed(oldTrial, oldSemantic, { ...baseForm, gender: "Female" }),
  true,
  "gender changes should be criteria-relevant"
);

assert.strictEqual(
  changed(oldTrial, oldSemantic, { ...baseForm, bmi: ">18 and <36" }),
  true,
  "BMI changes should be criteria-relevant"
);

assert.strictEqual(
  changed(oldTrial, oldSemantic, { ...baseForm, pregnancy: "No" }),
  true,
  "pregnancy changes should be criteria-relevant"
);

assert.strictEqual(
  changed(oldTrial, oldSemantic, { ...baseForm, pathology: "Diabetes" }),
  true,
  "pathology changes should be criteria-relevant"
);

assert.strictEqual(
  changed(oldTrial, oldSemantic, {
    ...baseForm,
    relatedConditions: "Cardiovascular Disease",
  }),
  true,
  "related-condition changes should be criteria-relevant"
);

assert.strictEqual(
  changed(oldTrial, oldSemantic, {
    ...baseForm,
    diseases: "Renal Disease, Cancer",
  }),
  true,
  "disease exclusion changes should be criteria-relevant"
);

assert.strictEqual(
  changed(oldTrial, oldSemantic, {
    ...baseForm,
    surgeries: "recent abdominal surgery, recent cardiac surgery",
  }),
  true,
  "surgery exclusion changes should be criteria-relevant"
);

assert.strictEqual(
  changed(oldTrial, oldSemantic, {
    ...baseForm,
    priorMedications: "warfarin, heparin",
  }),
  true,
  "medication exclusion changes should be criteria-relevant"
);

const reorderedSemantic = {
  source_type: "supplemental_agent",
  summary: " Stable   medications required. ",
  criteria_json: JSON.stringify({
    additionalTrialInformation: [
      {
        relevance: "High",
        category: "Medication stability",
        criterion: "Stable antihypertensive regimen for 4 weeks",
      },
    ],
    missingOrAmbiguousCriteria: ["Lab threshold timing unclear"],
  }),
};

assert.strictEqual(
  changed(oldTrial, oldSemantic, baseForm, reorderedSemantic),
  false,
  "semantic JSON object key order should not change criteria"
);

const multiSemantic = {
  source_type: "supplemental_agent",
  summary: "Stable medications and lab monitoring required.",
  criteria_json: JSON.stringify({
    missingOrAmbiguousCriteria: [],
    additionalTrialInformation: [
      {
        criterion: "Stable antihypertensive regimen for 4 weeks",
        category: "Medication stability",
        relevance: "High",
        sourceText: "Document section A",
      },
      {
        criterion: "Recent renal labs must be available",
        category: "Laboratory review",
        relevance: "Medium",
        notes: "Preserve this metadata",
      },
    ],
  }),
};

const oneCriterionDeletedSemantic = {
  source_type: "supplemental_agent",
  summary: "Stable medications and lab monitoring required.",
  criteria_json: JSON.stringify({
    missingOrAmbiguousCriteria: [],
    additionalTrialInformation: [
      {
        criterion: "Recent renal labs must be available",
        category: "Laboratory review",
        relevance: "Medium",
        notes: "Preserve this metadata",
      },
    ],
  }),
};

assert.strictEqual(
  changed(oldTrial, multiSemantic, baseForm, oneCriterionDeletedSemantic),
  true,
  "deleting one semantic criterion should be criteria-relevant"
);

assert.deepStrictEqual(
  JSON.parse(oneCriterionDeletedSemantic.criteria_json)
    .additionalTrialInformation[0],
  {
    criterion: "Recent renal labs must be available",
    category: "Laboratory review",
    relevance: "Medium",
    notes: "Preserve this metadata",
  },
  "deleting one semantic criterion should preserve remaining metadata"
);

const finalCriterionDeletedSemantic = {
  source_type: "supplemental_agent",
  summary: "Stable medications required.",
  criteria_json: JSON.stringify({
    missingOrAmbiguousCriteria: ["Lab threshold timing unclear"],
    additionalTrialInformation: [],
  }),
};

assert.strictEqual(
  changed(oldTrial, oldSemantic, baseForm, finalCriterionDeletedSemantic),
  true,
  "deleting the final semantic criterion should be criteria-relevant"
);

assert.strictEqual(
  changed(oldTrial, oldSemantic, {
    ...baseForm,
    relatedConditions: "Hypertension,\nCardiovascular Disease",
    diseases: "renal disease",
    priorMedications: " warfarin ",
  }),
  false,
  "comma, whitespace, and case-only list differences should not change criteria"
);

const manualSemantic = semanticRowFromPayload(1001, {
  sourceType: "manual_form",
  additionalTrialInformation: [
    {
      category: "Manual Entry",
      criterion: "Exclude recent hospitalization.",
      sourceText: "Exclude recent hospitalization.",
      relevance: "High",
      notes: null,
    },
  ],
  summary: "Manual additional trial / criteria information entered by the user.",
  missingOrAmbiguousCriteria: [],
});

assert.strictEqual(
  changed(oldTrial, oldSemantic, baseForm, manualSemantic),
  true,
  "manual replacement of supplemental criteria should be criteria-relevant"
);

const emptyTrial = {
  related_conditions: null,
  pathology: "",
  age_range: "",
  gender: null,
  exclusion_criteria: JSON.stringify({}),
};
const emptyForm = {
  relatedConditions: "",
  pathology: "",
  ageRange: "",
  gender: "",
  bmi: "",
  diseases: "",
  surgeries: "",
  priorMedications: "",
  pregnancy: "",
};

assert.strictEqual(
  changed(emptyTrial, null, emptyForm, null),
  false,
  "null and empty criteria should compare equally"
);

const oneSidedTrial = {
  related_conditions: "",
  pathology: "",
  age_range: "-65",
  gender: "",
  exclusion_criteria: JSON.stringify({ BMI: "< 35" }),
};
const oneSidedForm = {
  relatedConditions: "",
  pathology: "",
  ageRange: "-65",
  gender: "",
  bmi: "<35",
  diseases: "",
  surgeries: "",
  priorMedications: "",
  pregnancy: "",
};

assert.strictEqual(
  changed(oneSidedTrial, null, oneSidedForm, null),
  false,
  "one-sided age and BMI ranges should compare by the correct bound"
);

console.log("Trial edit criteria comparison validation passed.");
