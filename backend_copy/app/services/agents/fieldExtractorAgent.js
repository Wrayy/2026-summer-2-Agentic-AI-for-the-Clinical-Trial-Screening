const FIELD_KEYS = [
  "trialName",
  "trialId",
  "officialTitle",
  "location",
  "briefSummary",
  "detailedDescription",
  "startDate",
  "endDate",
  "sponsor",
  "principalInvestigator",
  "ethicsApproval",
  "primaryPurpose",
  "trialPhase",
  "studyType",
  "allocation",
  "interventionModel",
  "masking",
  "maskingDetails",
  "relatedConditions",
  "pathology",
  "gender",
  "ageRange",
  "bmiRange",
  "diseases",
  "surgeries",
  "priorMedications",
  "pregnancy",
];

const REQUIRED_FIELDS = [
  "trialName",
  "trialId",
  "officialTitle",
  "location",
  "briefSummary",
  "detailedDescription",
  "startDate",
  "sponsor",
  "principalInvestigator",
  "ethicsApproval",
  "relatedConditions",
  "pathology",
  "gender",
  "ageRange",
];

const COMMA_SEPARATED_FIELD_KEYS = [
  "relatedConditions",
  "pathology",
  "diseases",
  "surgeries",
  "priorMedications",
];

const FIELD_EXTRACTOR_PROMPT_VERSION = "field-extractor-prompt-v2";
const FIELD_EXTRACTOR_SCHEMA_VERSION = "field-extractor-schema-v2";
const DEFAULT_EXTRACTION_SEED = 424242;

function modelName() {
  return process.env.OPENAI_MODEL || "gpt-4.1-mini";
}

function supportsStrictJsonSchema(model) {
  return /^(gpt-4\.1|gpt-4o|gpt-5)/i.test(String(model || ""));
}

function supportsSeedParameter(model) {
  return /^(gpt-4\.1|gpt-4o|gpt-4-turbo|gpt-3\.5-turbo|gpt-5)/i.test(
    String(model || "")
  );
}

function extractionSeed() {
  const raw = process.env.OPENAI_EXTRACTION_SEED;
  const seed = raw == null || raw === "" ? DEFAULT_EXTRACTION_SEED : Number(raw);
  return Number.isSafeInteger(seed) ? seed : DEFAULT_EXTRACTION_SEED;
}

function stringOrNullProperty() {
  return { type: ["string", "null"] };
}

const FIELD_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["fields", "confidence"],
  properties: {
    fields: {
      type: "object",
      additionalProperties: false,
      required: FIELD_KEYS,
      properties: FIELD_KEYS.reduce((properties, key) => {
        properties[key] =
          key === "maskingDetails"
            ? {
                type: "object",
                additionalProperties: false,
                required: ["participant", "investigator"],
                properties: {
                  participant: { type: ["boolean", "null"] },
                  investigator: { type: ["boolean", "null"] },
                },
              }
            : stringOrNullProperty();
        return properties;
      }, {}),
    },
    confidence: {
      type: "object",
      additionalProperties: false,
      required: ["overall", "fieldNotes"],
      properties: {
        overall: { type: ["number", "null"] },
        fieldNotes: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["field", "confidence", "sourceNote", "needsReview"],
            properties: {
              field: { type: "string" },
              confidence: { type: ["number", "null"] },
              sourceNote: stringOrNullProperty(),
              needsReview: { type: "boolean" },
            },
          },
        },
      },
    },
  },
};

function responseFormatForModel(model) {
  if (!supportsStrictJsonSchema(model)) return { type: "json_object" };
  return {
    type: "json_schema",
    json_schema: {
      name: "clinical_trial_field_extraction",
      strict: true,
      schema: FIELD_RESPONSE_SCHEMA,
    },
  };
}

function deterministicRequestBody(documentText) {
  const model = modelName();
  const body = {
    model,
    messages: extractionPrompt(documentText),
    temperature: 0,
    response_format: responseFormatForModel(model),
  };
  if (supportsSeedParameter(model)) {
    body.seed = extractionSeed();
  }
  return body;
}

function emptyFields() {
  return FIELD_KEYS.reduce((fields, key) => {
    fields[key] = null;
    return fields;
  }, {});
}

function isEmptyValue(value) {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.values(value).every(isEmptyValue);
  return String(value).trim() === "";
}

function missingRequiredFields(fields) {
  return REQUIRED_FIELDS.filter((key) => isEmptyValue(fields[key]));
}

function normalizeFields(rawFields = {}) {
  const fields = emptyFields();
  for (const key of FIELD_KEYS) {
    fields[key] = rawFields[key] ?? null;
  }
  for (const key of COMMA_SEPARATED_FIELD_KEYS) {
    fields[key] = normalizeCommaSeparatedValue(fields[key]);
  }
  return fields;
}

function normalizeCommaSeparatedValue(value) {
  if (value == null) return null;
  const values = Array.isArray(value)
    ? value
    : String(value)
        .split(/[;\n]+/)
        .flatMap((item) => item.split(/\s*,\s*/));
  const seen = new Set();
  const cleaned = values
    .map(normalizeScalarText)
    .filter((item) => item && item.toLowerCase() !== "null")
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  if (cleaned.length === 0) return null;
  return cleaned.join(", ");
}

function normalizeScalarText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+([,.;:])/g, "$1");
}

function ensureFieldNotes(rawNotes) {
  if (!Array.isArray(rawNotes)) return [];
  return rawNotes
    .filter((note) => note && typeof note === "object")
    .map((note) => ({
      field: String(note.field || ""),
      confidence:
        typeof note.confidence === "number"
          ? Math.max(0, Math.min(1, note.confidence))
          : null,
      sourceNote: note.sourceNote ? String(note.sourceNote) : null,
      needsReview: Boolean(note.needsReview),
    }))
    .filter((note) => note.field);
}

function fieldsNeedingReview(fields, fieldNotes) {
  const reviewFields = new Set();
  for (const note of fieldNotes) {
    if (note.needsReview || (typeof note.confidence === "number" && note.confidence < 0.7)) {
      reviewFields.add(note.field);
    }
  }
  for (const key of FIELD_KEYS) {
    if (isEmptyValue(fields[key]) && !REQUIRED_FIELDS.includes(key)) {
      reviewFields.add(key);
    }
  }
  return Array.from(reviewFields);
}

function extractionPrompt(documentText) {
  return [
    {
      role: "system",
      content:
        "You are the Clinical Trial Document Field Extractor for an e-Hospital clinical trials POC. Extract only information directly supported by the document, prefer explicit eligibility/design/contact sections over incidental mentions, keep wording close to the source, and return strict JSON only.",
    },
    {
      role: "user",
      content: `Map this clinical trial document into the existing create-trial form fields.

Rules:
- Use null when a value is missing, unknown, not applicable, unrestricted without a specific value, or not supported by the document. Do not use empty strings.
- Do not invent values.
- Prefer explicit eligibility criteria over background summaries for eligibility fields. Prefer structured ClinicalTrials.gov module fields over repeated prose when they conflict. If the document conflicts internally, use the most specific eligibility/design section and flag the field in confidence.fieldNotes with needsReview=true.
- Dates must be YYYY-MM-DD when possible.
- trialId must be digits only, as a string, because it is stored in an integer database column. If the document's identifier contains letters or punctuation (for example a protocol ID like "MLS-101-202" or "NCT05769608"), extract only the digit characters and concatenate them (for example "101202"). If the identifier has no digits at all, return null.
- location should be one concise location string, such as "Ontario, Canada". For multi-location trials in one country, include all supported state/province/region values followed by the country, for example "Alabama, Arizona, California, United States". Do not return the country alone when state/province/region values are present.
- Order multiple locations, conditions, diseases, surgeries, and medications by the source order used in the document unless the source is unordered JSON, where the prepared input order is authoritative.
- ageRange must be a concise string like "18-65", "18-", or "-65". Use null when no age restriction is stated.
- bmiRange must describe the allowed BMI range, for example "> 18 and < 35", "> 18", or "< 35". Do not invert it into an excluded BMI range.
- gender must be Male, Female, Both, or null.
- pregnancy must be Yes, No, Unrestricted, or null.
- masking must be None (Open Label), Single, Double, or null.
- maskingDetails.participant must be true only when the document says participants/subjects/patients are masked or blinded, false only when it clearly says they are not masked/open-label, otherwise null.
- maskingDetails.investigator must be true only when the document says investigators/researchers are masked or blinded, false only when it clearly says they are not masked/open-label, otherwise null.
- relatedConditions should include trial conditions, keywords, or closely named related conditions listed for the study, comma-separated. Do not place disease exclusions here.
- pathology should include the primary condition(s), target diagnosis, or target population text. Do not use broad related keywords when a more specific target condition is stated.
- diseases should include disease or diagnosis exclusions only, comma-separated. Do not include lab thresholds unless they imply a named condition supported by the text.
- surgeries should include surgery/procedure exclusions only, comma-separated. Return null when no surgery exclusion is present.
- priorMedications is the form's Medication Exclusions field. Include only medications that would disqualify/exclude a patient, comma-separated. Do not include medications that are required for enrollment.
- Required medications, medication stability, prior treatment failures, washout periods, lab thresholds, organ-function requirements, and timing windows belong in supplemental criteria, not in priorMedications unless the medication is explicitly disqualifying.
- Include confidence.fieldNotes with short source notes, not long quotes.
- Use concise canonical values and avoid stylistic paraphrasing. Do not return "none", "N/A", "unknown", or "not specified"; use null instead.

Return JSON with this exact top-level shape:
{
  "fields": {
    "trialName": null,
    "trialId": null,
    "officialTitle": null,
    "location": null,
    "briefSummary": null,
    "detailedDescription": null,
    "startDate": null,
    "endDate": null,
    "sponsor": null,
    "principalInvestigator": null,
    "ethicsApproval": null,
    "primaryPurpose": null,
    "trialPhase": null,
    "studyType": null,
    "allocation": null,
    "interventionModel": null,
    "masking": null,
    "maskingDetails": {
      "participant": null,
      "investigator": null
    },
    "relatedConditions": null,
    "pathology": null,
    "gender": null,
    "ageRange": null,
    "bmiRange": null,
    "diseases": null,
    "surgeries": null,
    "priorMedications": null,
    "pregnancy": null
  },
  "confidence": {
    "overall": 0,
    "fieldNotes": []
  }
}

Document:
${documentText.slice(0, 60000)}`,
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

async function callOpenAiExtractor(documentText) {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error(
      "Clinical Trial Document Field Extractor requires OPENAI_API_KEY in backend_copy/.env."
    );
    error.statusCode = 503;
    throw error;
  }

  const requestBody = deterministicRequestBody(documentText);
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(requestBody),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      body.error && body.error.message
        ? body.error.message
        : "OpenAI extraction request failed.";
    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }

  const content = body.choices?.[0]?.message?.content;
  if (!content) {
    const error = new Error("OpenAI extraction returned an empty response.");
    error.statusCode = 502;
    throw error;
  }

  return {
    result: parseJsonContent(content),
    metadata: {
      responseFormat: requestBody.response_format.type,
      seed: requestBody.seed ?? null,
      systemFingerprint: body.system_fingerprint || null,
    },
  };
}

// clinical_trials.trial_id is an integer column. The LLM is instructed to
// return digits only, but this is a safety net in case it returns the raw
// document identifier (e.g. "MLS-101-202") instead: falls back to the
// digits-only portion, same convention used for local NCT-style seed trials.
function normalizeTrialId(rawTrialId) {
  if (rawTrialId == null) return { trialId: null, wasNormalized: false };
  const text = String(rawTrialId).trim();
  if (text === "") return { trialId: null, wasNormalized: false };
  if (/^\d+$/.test(text)) return { trialId: text, wasNormalized: false };
  const digits = (text.match(/\d+/g) || []).join("");
  if (digits === "") return { trialId: null, wasNormalized: false };
  return { trialId: digits, wasNormalized: true };
}

// clinical_trials.start_date/end_date are DATE columns and the copied
// backend does `new Date(startDate).toISOString()` on create, which throws
// on an unparseable string instead of failing gracefully. Coerce to
// YYYY-MM-DD or null so a malformed date can never reach that call.
function normalizeDate(rawValue) {
  if (rawValue == null) return { value: null, wasNormalized: false };
  const text = String(rawValue).trim();
  if (text === "") return { value: null, wasNormalized: false };

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return Number.isNaN(new Date(text).getTime())
      ? { value: null, wasNormalized: true }
      : { value: text, wasNormalized: false };
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return { value: null, wasNormalized: true };
  return { value: parsed.toISOString().split("T")[0], wasNormalized: true };
}

// gender/pregnancy feed exact-string-equality checks in deterministic
// matching (both the existing userController.js matching and the new
// deterministicMatchingService.js), so a value outside the exact allowed
// set would silently fail to match rather than error. Snap to the
// canonical value (case-insensitively) or null out so the Flutter form
// falls back to its default dropdown selection instead of submitting a
// value matching can never satisfy.
function normalizeEnum(rawValue, allowedValues) {
  if (rawValue == null) return { value: null, wasNormalized: false };
  const text = String(rawValue).trim();
  if (text === "") return { value: null, wasNormalized: false };
  const match = allowedValues.find(
    (allowed) => allowed.toLowerCase() === text.toLowerCase()
  );
  if (match) return { value: match, wasNormalized: match !== text };
  return { value: null, wasNormalized: true };
}

function normalizeAgeRangeValue(rawValue) {
  if (rawValue == null) return { value: null, wasNormalized: false };
  if (typeof rawValue === "object" && !Array.isArray(rawValue)) {
    const min = rawValue.min ?? rawValue.minimum ?? null;
    const max = rawValue.max ?? rawValue.maximum ?? null;
    const value = formatRange(min, max);
    return { value, wasNormalized: value !== rawValue };
  }
  const text = normalizeScalarText(rawValue);
  if (!text) return { value: null, wasNormalized: false };
  const lower = text.toLowerCase();
  if (["null", "none", "n/a", "not applicable", "unknown", "not specified"].includes(lower)) {
    return { value: null, wasNormalized: true };
  }
  const numbers = text.match(/\d+(?:\.\d+)?/g) || [];
  if (numbers.length >= 2) {
    const value = `${numbers[0]}-${numbers[1]}`;
    return { value, wasNormalized: value !== text };
  }
  if (numbers.length === 1) {
    const value = lower.includes("<") || /^\s*[-–—]/.test(text)
      ? `-${numbers[0]}`
      : `${numbers[0]}-`;
    return { value, wasNormalized: value !== text };
  }
  return { value: text, wasNormalized: false };
}

function normalizeBmiRangeValue(rawValue) {
  if (rawValue == null) return { value: null, wasNormalized: false };
  const text = normalizeScalarText(rawValue);
  if (!text) return { value: null, wasNormalized: false };
  const lower = text.toLowerCase();
  if (["null", "none", "n/a", "not applicable", "unknown", "not specified"].includes(lower)) {
    return { value: null, wasNormalized: true };
  }
  const numbers = text.match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
  if (numbers.length >= 2) {
    const sorted = [numbers[0], numbers[1]].sort((a, b) => a - b);
    const value = `> ${formatNumber(sorted[0])} and < ${formatNumber(sorted[1])}`;
    return { value, wasNormalized: value !== text };
  }
  if (numbers.length === 1) {
    const value = text.includes("<")
      ? `< ${formatNumber(numbers[0])}`
      : `> ${formatNumber(numbers[0])}`;
    return { value, wasNormalized: value !== text };
  }
  return { value: text, wasNormalized: false };
}

function formatRange(min, max) {
  const minNumber = normalizeNumericText(min);
  const maxNumber = normalizeNumericText(max);
  if (minNumber == null && maxNumber == null) return null;
  return `${minNumber ?? ""}-${maxNumber ?? ""}`;
}

function normalizeNumericText(value) {
  if (value == null || value === "") return null;
  const match = String(value).match(/\d+(?:\.\d+)?/);
  return match ? formatNumber(Number(match[0])) : null;
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return null;
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}

function normalizeMaskingDetails(rawValue, masking) {
  const details = { participant: null, investigator: null };

  if (rawValue && typeof rawValue === "object" && !Array.isArray(rawValue)) {
    for (const key of ["participant", "investigator"]) {
      if (typeof rawValue[key] === "boolean") details[key] = rawValue[key];
    }
  }

  const text = [
    masking,
    typeof rawValue === "string" ? rawValue : null,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    details.participant == null &&
    /\b(participant|participants|subject|subjects|patient|patients)\b/.test(text)
  ) {
    details.participant = true;
  }
  if (
    details.investigator == null &&
    /\b(investigator|investigators|researcher|researchers)\b/.test(text)
  ) {
    details.investigator = true;
  }
  if (
    text.includes("open label") ||
    text.includes("open-label") ||
    text.includes("none")
  ) {
    details.participant = false;
    details.investigator = false;
  }
  if (String(masking || "").toLowerCase() === "double") {
    if (details.participant == null) details.participant = true;
    if (details.investigator == null) details.investigator = true;
  }

  return { value: details, wasNormalized: false };
}

async function extractFieldsFromText(documentText, source = {}) {
  const { result: llmResult, metadata = {} } =
    await callOpenAiExtractor(documentText);
  const fields = normalizeFields(llmResult.fields);
  const normalizedFlags = [];

  const applyNormalization = (key, { value, wasNormalized }) => {
    fields[key] = value;
    if (wasNormalized) normalizedFlags.push(key);
  };

  applyNormalization("trialId", normalizeTrialId(fields.trialId));
  applyNormalization("ageRange", normalizeAgeRangeValue(fields.ageRange));
  applyNormalization("bmiRange", normalizeBmiRangeValue(fields.bmiRange));
  applyNormalization("startDate", normalizeDate(fields.startDate));
  applyNormalization("endDate", normalizeDate(fields.endDate));
  applyNormalization("gender", normalizeEnum(fields.gender, ["Male", "Female", "Both"]));
  applyNormalization(
    "masking",
    normalizeEnum(fields.masking, ["None (Open Label)", "Single", "Double"])
  );
  applyNormalization(
    "pregnancy",
    normalizeEnum(fields.pregnancy, ["Yes", "No", "Unrestricted"])
  );
  applyNormalization(
    "maskingDetails",
    normalizeMaskingDetails(fields.maskingDetails, fields.masking)
  );

  const fieldNotes = ensureFieldNotes(llmResult.confidence?.fieldNotes);
  const missing = missingRequiredFields(fields);

  return {
    extractedFields: fields,
    missingRequiredFields: missing,
    fieldsNeedingReview: Array.from(
      new Set([...fieldsNeedingReview(fields, fieldNotes), ...missing, ...normalizedFlags])
    ),
    confidence: {
      overall:
        typeof llmResult.confidence?.overall === "number"
          ? Math.max(0, Math.min(1, llmResult.confidence.overall))
          : null,
      fieldNotes,
    },
    source: {
      ...source,
      extractor: "openai",
      model: modelName(),
      fieldExtractorVersion: FIELD_EXTRACTOR_PROMPT_VERSION,
      fieldExtractorSchemaVersion: FIELD_EXTRACTOR_SCHEMA_VERSION,
      responseFormat: metadata.responseFormat,
      seed: metadata.seed,
      systemFingerprint: metadata.systemFingerprint,
    },
  };
}

module.exports = {
  FIELD_KEYS,
  FIELD_EXTRACTOR_PROMPT_VERSION,
  FIELD_EXTRACTOR_SCHEMA_VERSION,
  REQUIRED_FIELDS,
  extractFieldsFromText,
  normalizeFields,
  normalizeCommaSeparatedValue,
  normalizeAgeRangeValue,
  normalizeBmiRangeValue,
  responseFormatForModel,
};
