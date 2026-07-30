function modelName() {
  return process.env.OPENAI_MODEL || "gpt-4.1-mini";
}

const SUPPLEMENTAL_EXTRACTOR_PROMPT_VERSION = "supplemental-extractor-prompt-v2";
const SUPPLEMENTAL_EXTRACTOR_SCHEMA_VERSION = "supplemental-extractor-schema-v2";
const DEFAULT_EXTRACTION_SEED = 424242;
const RELEVANCE_VALUES = ["High", "Medium", "Low"];
const CANONICAL_CATEGORIES = [
  "Target-condition nuance",
  "Disease severity or stage",
  "Required medication or medication stability",
  "Prior treatment requirements or treatment failures",
  "Laboratory thresholds",
  "Organ-function requirements",
  "Recent hospitalization or acute-event restrictions",
  "Surgery/procedure timing",
  "Comorbidities and contraindications",
  "Reproductive or contraceptive requirements",
  "Timing windows and washout periods",
  "Functional or performance status",
  "Other explicit medical criteria",
  "Clinically relevant missing or ambiguous information",
  "Manual Entry",
  "User Added",
  "General",
];

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

const SUPPLEMENTAL_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "additionalTrialInformation",
    "summary",
    "missingOrAmbiguousCriteria",
  ],
  properties: {
    additionalTrialInformation: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["category", "criterion", "sourceText", "relevance", "notes"],
        properties: {
          category: { type: "string" },
          criterion: { type: "string" },
          sourceText: { type: ["string", "null"] },
          relevance: { type: "string", enum: RELEVANCE_VALUES },
          notes: { type: ["string", "null"] },
        },
      },
    },
    summary: { type: "string" },
    missingOrAmbiguousCriteria: {
      type: "array",
      items: { type: "string" },
    },
  },
};

function responseFormatForModel(model) {
  if (!supportsStrictJsonSchema(model)) return { type: "json_object" };
  return {
    type: "json_schema",
    json_schema: {
      name: "supplemental_criteria_extraction",
      strict: true,
      schema: SUPPLEMENTAL_RESPONSE_SCHEMA,
    },
  };
}

function deterministicRequestBody(documentText, requiredFields) {
  const model = modelName();
  const body = {
    model,
    messages: extractionPrompt(documentText, requiredFields),
    temperature: 0,
    response_format: responseFormatForModel(model),
  };
  if (supportsSeedParameter(model)) {
    body.seed = extractionSeed();
  }
  return body;
}

function ensureAdditionalInformation(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  const items = raw
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      category: canonicalCategory(item.category),
      criterion: normalizeText(item.criterion),
      sourceText: normalizeNullableText(item.sourceText),
      relevance: RELEVANCE_VALUES.includes(item.relevance)
        ? item.relevance
        : "Medium",
      notes: normalizeNullableText(item.notes),
    }))
    .filter((item) => item.criterion)
    .filter((item) => {
      const key = normalizeDuplicateKey(item.criterion);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return items.sort((a, b) => {
    const categoryComparison =
      categoryOrder(a.category) - categoryOrder(b.category);
    if (categoryComparison !== 0) return categoryComparison;
    return a.criterion.toLowerCase().localeCompare(b.criterion.toLowerCase());
  });
}

function ensureStringList(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => String(item || "").trim())
    .filter((item) => item.length > 0);
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+([,.;:])/g, "$1");
}

function normalizeNullableText(value) {
  const text = normalizeText(value);
  return text ? text : null;
}

function normalizeDuplicateKey(value) {
  return normalizeText(value).toLowerCase();
}

function categoryOrder(category) {
  const index = CANONICAL_CATEGORIES.indexOf(category);
  return index === -1 ? CANONICAL_CATEGORIES.length : index;
}

function canonicalCategory(value) {
  const raw = normalizeText(value);
  if (!raw) return "General";
  const normalized = raw.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const direct = CANONICAL_CATEGORIES.find(
    (category) =>
      category.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim() === normalized
  );
  if (direct) return direct;
  if (normalized.includes("target") || normalized.includes("condition nuance")) {
    return "Target-condition nuance";
  }
  if (normalized.includes("severity") || normalized.includes("stage")) {
    return "Disease severity or stage";
  }
  if (normalized.includes("medication") || normalized.includes("stability")) {
    return "Required medication or medication stability";
  }
  if (normalized.includes("prior treatment") || normalized.includes("failure")) {
    return "Prior treatment requirements or treatment failures";
  }
  if (normalized.includes("lab") || normalized.includes("threshold")) {
    return "Laboratory thresholds";
  }
  if (normalized.includes("organ")) return "Organ-function requirements";
  if (normalized.includes("hospital") || normalized.includes("acute")) {
    return "Recent hospitalization or acute-event restrictions";
  }
  if (normalized.includes("surgery") || normalized.includes("procedure")) {
    return "Surgery/procedure timing";
  }
  if (normalized.includes("comorbid") || normalized.includes("contraindication")) {
    return "Comorbidities and contraindications";
  }
  if (normalized.includes("reproductive") || normalized.includes("contracept")) {
    return "Reproductive or contraceptive requirements";
  }
  if (normalized.includes("washout") || normalized.includes("timing")) {
    return "Timing windows and washout periods";
  }
  if (normalized.includes("performance") || normalized.includes("functional")) {
    return "Functional or performance status";
  }
  if (normalized.includes("missing") || normalized.includes("ambiguous")) {
    return "Clinically relevant missing or ambiguous information";
  }
  if (normalized.includes("manual")) return "Manual Entry";
  if (normalized.includes("user")) return "User Added";
  return "Other explicit medical criteria";
}

function summarizedRequiredFields(requiredFields = {}) {
  const { trialName, inclusionCriteria, exclusionCriteria } = requiredFields;
  return JSON.stringify(
    {
      trialName: trialName || null,
      inclusionCriteria: inclusionCriteria || null,
      exclusionCriteria: exclusionCriteria || null,
    },
    null,
    2
  );
}

function extractionPrompt(documentText, requiredFields) {
  return [
    {
      role: "system",
      content:
        "You are the Supplemental Criteria Interpretation Agent for an e-Hospital clinical trials POC. You find medically relevant eligibility information in a trial document that is not fully captured by the create-trial form fields. Multi-value/free-text clinical form fields such as related conditions, pathology, diseases, surgeries, and medication exclusions are later used as semantic clinical context, so do not simply repeat those field values unless the document adds timing, severity, stability, history, lab, contraindication, or other nuance. You do not score or recommend anything. Return strict JSON only.",
    },
    {
      role: "user",
      content: `Read this clinical trial document and extract additional medically relevant eligibility criteria that are not already represented by the structured fields below.

Evaluate this checklist in exactly this order and use the listed canonical category name when you include an item:
1. Target-condition nuance
2. Disease severity or stage
3. Required medication or medication stability
4. Prior treatment requirements or treatment failures
5. Laboratory thresholds
6. Organ-function requirements
7. Recent hospitalization or acute-event restrictions
8. Surgery/procedure timing
9. Comorbidities and contraindications
10. Reproductive or contraceptive requirements
11. Timing windows and washout periods
12. Functional or performance status
13. Other explicit medical criteria
14. Clinically relevant missing or ambiguous information

Do not include exact duplicates of the structured fields already captured. Include nuanced details connected to those fields when they matter clinically, such as severity, timing windows, stability requirements, contraindications, or lab thresholds:
${summarizedRequiredFields(requiredFields)}

Rules:
- Only include criteria actually supported by the document text.
- Do not invent values.
- "relevance" must be High, Medium, or Low.
- Use "High" only for criteria that are likely to directly determine eligibility, such as explicit inclusion/exclusion rules, required treatment regimens, lab thresholds, disease severity thresholds, organ function limits, timing windows, contraindications, or safety exclusions.
- Use "Medium" for clinically useful criteria that may influence reviewer judgment but are not clearly disqualifying by themselves, such as stability requirements, monitoring details, contextual comorbidity nuance, or information that needs confirmation.
- Use "Low" for weak supporting context, background eligibility detail, or operational nuance that is medically relevant but unlikely to change eligibility alone.
- Keep "criterion" concise and specific.
- Use "sourceText" for a short supporting quote or paraphrase, or null.
- Keep terminology stable and close to the document. Do not vary wording for style.
- Do not merge clinically separate requirements. Do not split one requirement into several items unless each item is independently evaluable.
- Do not duplicate a base structured field unless the document adds timing, severity, stability, threshold, contraindication, history, or another meaningful eligibility nuance.
- Use stable ordering based on the checklist above.
- List any criteria that are ambiguous or incomplete in missingOrAmbiguousCriteria.

Return JSON with this exact top-level shape:
{
  "additionalTrialInformation": [
    {
      "category": "string",
      "criterion": "string",
      "sourceText": "string or null",
      "relevance": "High | Medium | Low",
      "notes": "string or null"
    }
  ],
  "summary": "string",
  "missingOrAmbiguousCriteria": ["string"]
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

async function callOpenAiSupplementalAgent(documentText, requiredFields) {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error(
      "Supplemental Criteria Interpretation Agent requires OPENAI_API_KEY in backend_copy/.env."
    );
    error.statusCode = 503;
    throw error;
  }

  const requestBody = deterministicRequestBody(documentText, requiredFields);
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
        : "OpenAI supplemental criteria request failed.";
    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }

  const content = body.choices?.[0]?.message?.content;
  if (!content) {
    const error = new Error(
      "OpenAI supplemental criteria extraction returned an empty response."
    );
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

async function extractSupplementalCriteriaFromText(
  documentText,
  requiredFields = {},
  source = {}
) {
  const { result: llmResult, metadata = {} } =
    await callOpenAiSupplementalAgent(documentText, requiredFields);
  const additionalTrialInformation = ensureAdditionalInformation(
    llmResult.additionalTrialInformation
  );

  return {
    additionalTrialInformation,
    summary: String(llmResult.summary || "").trim(),
    missingOrAmbiguousCriteria: ensureStringList(llmResult.missingOrAmbiguousCriteria),
    source: {
      ...source,
      extractor: "openai",
      model: modelName(),
      supplementalExtractorVersion: SUPPLEMENTAL_EXTRACTOR_PROMPT_VERSION,
      supplementalExtractorSchemaVersion: SUPPLEMENTAL_EXTRACTOR_SCHEMA_VERSION,
      responseFormat: metadata.responseFormat,
      seed: metadata.seed,
      systemFingerprint: metadata.systemFingerprint,
    },
  };
}

module.exports = {
  CANONICAL_CATEGORIES,
  SUPPLEMENTAL_EXTRACTOR_PROMPT_VERSION,
  SUPPLEMENTAL_EXTRACTOR_SCHEMA_VERSION,
  extractSupplementalCriteriaFromText,
  ensureAdditionalInformation,
  responseFormatForModel,
};
