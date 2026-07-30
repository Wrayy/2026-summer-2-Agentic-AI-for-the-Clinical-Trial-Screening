const mammoth = require("mammoth");
const pdfParse = require("pdf-parse");
const crypto = require("crypto");
const fieldExtractorAgent = require("./agents/fieldExtractorAgent");
const supplementalCriteriaAgent = require("./agents/supplementalCriteriaAgent");

const DOCUMENT_PREPROCESSING_VERSION = "document-preprocessing-v2";
const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/json",
  "text/plain",
  "text/markdown",
]);

const SUPPORTED_EXTENSIONS = new Set([".pdf", ".docx", ".json", ".txt", ".md"]);
const MIN_READABLE_TEXT_CHARACTERS = 40;
const MAX_AGENT_INPUT_CHARACTERS = 48000;
const LARGE_DOCUMENT_CHARACTERS = 60000;
const SECTION_FOLLOWING_PARAGRAPHS = 2;

const CLINICAL_TRIAL_KEYWORDS = [
  "clinical trial",
  "nct",
  "study",
  "trial",
  "eligibility",
  "inclusion criteria",
  "exclusion criteria",
  "intervention",
  "outcome",
  "phase",
  "enrollment",
  "condition",
  "randomized",
  "placebo",
  "sponsor",
  "arms",
  "masking",
];

const RELEVANT_SECTION_KEYWORDS = [
  "title",
  "brief title",
  "official title",
  "summary",
  "description",
  "condition",
  "eligibility",
  "criteria",
  "inclusion",
  "exclusion",
  "intervention",
  "arm",
  "outcome",
  "phase",
  "design",
  "enrollment",
  "sponsor",
  "location",
  "contact",
  "sex",
  "gender",
  "age",
];

function getExtension(filename = "") {
  const match = filename.toLowerCase().match(/\.[^.]+$/);
  return match ? match[0] : "";
}

function createDocumentError(message, statusCode = 400, errorCode = "DOCUMENT_ERROR") {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.errorCode = errorCode;
  return error;
}

function validateFile(file) {
  if (!file) {
    throw createDocumentError(
      "Upload a PDF, DOCX, JSON, TXT, or MD clinical trial document.",
      400,
      "DOCUMENT_REQUIRED"
    );
  }

  const extension = getExtension(file.originalname);
  if (!SUPPORTED_MIME_TYPES.has(file.mimetype) && !SUPPORTED_EXTENSIONS.has(extension)) {
    throw createDocumentError(
      "Unsupported document format. Upload a PDF, DOCX, JSON, TXT, or MD file.",
      400,
      "UNSUPPORTED_DOCUMENT_FORMAT"
    );
  }
}

function getFileKind(file) {
  const extension = getExtension(file.originalname);
  if (file.mimetype === "application/pdf" || extension === ".pdf") return "pdf";
  if (
    file.mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    extension === ".docx"
  ) {
    return "docx";
  }
  if (file.mimetype === "application/json" || extension === ".json") return "json";
  if (file.mimetype === "text/markdown" || extension === ".md") return "md";
  if (file.mimetype === "text/plain" || extension === ".txt") return "txt";
  return null;
}

async function prepareDocumentForExtraction(file) {
  validateFile(file);
  const fileKind = getFileKind(file);

  if (fileKind === "pdf") {
    return prepareTextDocument(
      await extractPdfText(file),
      file,
      fileKind,
      "This PDF appears to contain little or no selectable text. Upload a text-based PDF, DOCX, TXT, MD, or ClinicalTrials.gov JSON export."
    );
  }

  if (fileKind === "docx") {
    return prepareTextDocument(
      await extractDocxText(file),
      file,
      fileKind,
      "No readable text could be extracted from the DOCX file."
    );
  }

  if (fileKind === "json") {
    return prepareJsonDocument(file);
  }

  if (fileKind === "md") {
    const decoded = decodeTextBuffer(file.buffer);
    return prepareTextDocument(
      normalizeWhitespace(decoded.text),
      file,
      fileKind,
      "No readable Markdown text could be extracted from the uploaded document.",
      { textEncoding: decoded.encoding }
    );
  }

  if (fileKind === "txt") {
    const decoded = decodeTextBuffer(file.buffer);
    return prepareTextDocument(
      normalizeWhitespace(decoded.text),
      file,
      fileKind,
      "No readable plain text could be extracted from the uploaded document.",
      { textEncoding: decoded.encoding }
    );
  }

  throw createDocumentError(
    "Unsupported document format. Upload a PDF, DOCX, JSON, TXT, or MD file.",
    400,
    "UNSUPPORTED_DOCUMENT_FORMAT"
  );
}

async function extractPdfText(file) {
  try {
    const parsed = await pdfParse(file.buffer);
    return normalizeWhitespace(parsed.text);
  } catch (error) {
    throw createDocumentError(
      `Could not read the PDF file: ${error.message}`,
      400,
      "PDF_PARSE_FAILED"
    );
  }
}

async function extractDocxText(file) {
  try {
    const parsed = await mammoth.extractRawText({ buffer: file.buffer });
    return normalizeWhitespace(parsed.value);
  } catch (error) {
    throw createDocumentError(
      `Could not read the DOCX file: ${error.message}`,
      400,
      "DOCX_PARSE_FAILED"
    );
  }
}

function prepareTextDocument(documentText, file, fileKind, emptyMessage, sourceExtras = {}) {
  if (documentText.length < MIN_READABLE_TEXT_CHARACTERS) {
    throw createDocumentError(
      emptyMessage,
      400,
      fileKind === "pdf" ? "PDF_NO_READABLE_TEXT" : "DOCUMENT_NO_READABLE_TEXT"
    );
  }

  if (!looksLikeClinicalTrialText(documentText)) {
    throw createDocumentError(
      "Could not find clinical trial fields in the uploaded document.",
      400,
      "CLINICAL_TRIAL_FIELDS_NOT_FOUND"
    );
  }

  const preparedText = reduceDocumentForExtraction(documentText);
  return {
    documentText: preparedText.text,
    source: buildSource(file, fileKind, documentText.length, preparedText.text.length, {
      ...sourceExtras,
      wasReduced: preparedText.wasReduced,
      preparedDocumentText: preparedText.text,
    }),
  };
}

function prepareJsonDocument(file) {
  const decoded = decodeTextBuffer(file.buffer);
  const rawText = decoded.text.trim();
  if (!rawText) {
    throw createDocumentError(
      "The uploaded JSON file is empty.",
      400,
      "JSON_EMPTY"
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (error) {
    throw createDocumentError(
      `Invalid JSON syntax: ${error.message}`,
      400,
      "INVALID_JSON"
    );
  }

  const clinicalTrialText = clinicalTrialsGovJsonToText(parsed);
  if (!clinicalTrialText) {
    throw createDocumentError(
      "Could not find clinical trial fields in the uploaded JSON document.",
      400,
      "CLINICAL_TRIAL_FIELDS_NOT_FOUND"
    );
  }

  const preparedText = reduceDocumentForExtraction(clinicalTrialText);
  return {
    documentText: preparedText.text,
    source: buildSource(file, "json", rawText.length, preparedText.text.length, {
      textEncoding: decoded.encoding,
      wasReduced: preparedText.wasReduced || rawText.length > preparedText.text.length,
      originalJsonCharacters: rawText.length,
      preparedDocumentText: preparedText.text,
    }),
  };
}

function normalizeWhitespace(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeTextBuffer(buffer) {
  const input = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || "");
  if (input.length >= 2 && input[0] === 0xff && input[1] === 0xfe) {
    return {
      text: input.subarray(2).toString("utf16le"),
      encoding: "utf-16le",
    };
  }
  if (input.length >= 2 && input[0] === 0xfe && input[1] === 0xff) {
    return {
      text: decodeUtf16Be(input.subarray(2)),
      encoding: "utf-16be",
    };
  }
  if (input.length >= 3 && input[0] === 0xef && input[1] === 0xbb && input[2] === 0xbf) {
    return {
      text: input.subarray(3).toString("utf8"),
      encoding: "utf-8-bom",
    };
  }
  return {
    text: input.toString("utf8"),
    encoding: "utf-8",
  };
}

function decodeUtf16Be(buffer) {
  const evenLength = buffer.length - (buffer.length % 2);
  const swapped = Buffer.alloc(evenLength);
  for (let index = 0; index < evenLength; index += 2) {
    swapped[index] = buffer[index + 1];
    swapped[index + 1] = buffer[index];
  }
  return swapped.toString("utf16le");
}

function buildSource(file, fileKind, originalTextCharacters, extractedTextCharacters, extras = {}) {
  const { preparedDocumentText, ...safeExtras } = extras;
  return {
    filename: file.originalname,
    mimeType: file.mimetype,
    fileKind,
    originalTextCharacters,
    extractedTextCharacters,
    documentFingerprint: shortDocumentFingerprint(preparedDocumentText || ""),
    preprocessingVersion: DOCUMENT_PREPROCESSING_VERSION,
    ...safeExtras,
  };
}

function clinicalTrialsGovJsonToText(parsed) {
  const protocol = parsed && typeof parsed === "object" ? parsed.protocolSection : null;
  if (!protocol || typeof protocol !== "object") return null;

  const identification = protocol.identificationModule || {};
  const status = protocol.statusModule || {};
  const sponsor = protocol.sponsorCollaboratorsModule || {};
  const description = protocol.descriptionModule || {};
  const conditions = protocol.conditionsModule || {};
  const design = protocol.designModule || {};
  const armsInterventions = protocol.armsInterventionsModule || {};
  const outcomes = protocol.outcomesModule || {};
  const eligibility = protocol.eligibilityModule || {};
  const contactsLocations = protocol.contactsLocationsModule || {};

  const hasCoreField =
    identification.nctId ||
    identification.briefTitle ||
    identification.officialTitle ||
    description.briefSummary ||
    description.detailedDescription ||
    eligibility.eligibilityCriteria;
  if (!hasCoreField) return null;

  const lines = [];
  addLine(lines, "NCT ID", identification.nctId);
  addLine(lines, "Organization Study ID", identification.orgStudyIdInfo?.id);
  addLine(lines, "Brief Title", identification.briefTitle);
  addLine(lines, "Official Title", identification.officialTitle);
  addLine(lines, "Overall Status", status.overallStatus);
  addLine(lines, "Start Date", dateStructToText(status.startDateStruct));
  addLine(lines, "Primary Completion Date", dateStructToText(status.primaryCompletionDateStruct));
  addLine(lines, "Completion Date", dateStructToText(status.completionDateStruct));
  addLine(lines, "Lead Sponsor", sponsor.leadSponsor?.name);
  addLine(lines, "Brief Summary", description.briefSummary);
  addLine(lines, "Detailed Description", description.detailedDescription);
  addLine(lines, "Conditions", listToText(conditions.conditions));
  addLine(lines, "Keywords", listToText(conditions.keywords));
  addLine(lines, "Study Type", design.studyType);
  addLine(lines, "Phases", listToText(design.phases));
  addLine(lines, "Enrollment", enrollmentToText(design.enrollmentInfo));
  addLine(lines, "Allocation", design.designInfo?.allocation);
  addLine(lines, "Intervention Model", design.designInfo?.interventionModel);
  addLine(lines, "Primary Purpose", design.designInfo?.primaryPurpose);
  addLine(lines, "Masking", maskingToText(design.designInfo?.maskingInfo));
  addLine(lines, "Arms", armGroupsToText(armsInterventions.armGroups));
  addLine(lines, "Interventions", interventionsToText(armsInterventions.interventions));
  addLine(lines, "Primary Outcomes", outcomesToText(outcomes.primaryOutcomes));
  addLine(lines, "Secondary Outcomes", outcomesToText(outcomes.secondaryOutcomes));
  addLine(lines, "Eligibility Criteria", eligibility.eligibilityCriteria);
  addLine(lines, "Sex", eligibility.sex);
  addLine(lines, "Minimum Age", eligibility.minimumAge);
  addLine(lines, "Maximum Age", eligibility.maximumAge);
  addLine(lines, "Healthy Volunteers", eligibility.healthyVolunteers);
  addLine(lines, "Standard Ages", listToText(eligibility.stdAges));
  addLine(lines, "Locations", locationsToText(contactsLocations.locations));

  const text = normalizeWhitespace(lines.join("\n"));
  return looksLikeClinicalTrialText(text) ? text : null;
}

function addLine(lines, label, value) {
  const text = valueToText(value);
  if (text) lines.push(`${label}: ${text}`);
}

function valueToText(value) {
  if (value == null) return "";
  if (Array.isArray(value)) return listToText(value);
  if (typeof value === "object") return normalizeWhitespace(stableJsonStringify(value));
  return normalizeWhitespace(String(value));
}

function stableJsonStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(stableJsonStringify).join(",")}]`;
  }
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJsonStringify(value[key])}`)
    .join(",")}}`;
}

function shortDocumentFingerprint(text) {
  return crypto
    .createHash("sha256")
    .update(String(text || ""), "utf8")
    .digest("hex")
    .slice(0, 16);
}

function listToText(values, limit = 40) {
  if (!Array.isArray(values)) return valueToText(values);
  return values
    .slice(0, limit)
    .map(valueToText)
    .filter(Boolean)
    .join("; ");
}

function dateStructToText(value) {
  if (!value) return "";
  return [value.date, value.type].filter(Boolean).join(" ");
}

function enrollmentToText(value) {
  if (!value) return "";
  return [value.count, value.type].filter((part) => part !== undefined && part !== null).join(" ");
}

function maskingToText(value) {
  if (!value) return "";
  const parties = Array.isArray(value.whoMasked) ? ` (${value.whoMasked.join(", ")})` : "";
  return `${value.masking || ""}${parties}`.trim();
}

function armGroupsToText(values) {
  if (!Array.isArray(values)) return "";
  return values
    .slice(0, 20)
    .map((arm) =>
      [arm.label, arm.type, arm.description, listToText(arm.interventionNames)]
        .filter(Boolean)
        .join(" - ")
    )
    .filter(Boolean)
    .join("\n");
}

function interventionsToText(values) {
  if (!Array.isArray(values)) return "";
  return values
    .slice(0, 20)
    .map((intervention) =>
      [intervention.name, intervention.type, intervention.description]
        .filter(Boolean)
        .join(" - ")
    )
    .filter(Boolean)
    .join("\n");
}

function outcomesToText(values) {
  if (!Array.isArray(values)) return "";
  return values
    .slice(0, 20)
    .map((outcome) =>
      [outcome.measure, outcome.timeFrame, outcome.description]
        .filter(Boolean)
        .join(" - ")
    )
    .filter(Boolean)
    .join("\n");
}

function locationsToText(values) {
  if (!Array.isArray(values) || values.length === 0) return "";

  const countries = uniqueValues(values.map((location) => location.country));
  const states = uniqueValues(values.map((location) => location.state)).slice(0, 20);
  const firstLocation = values.find(
    (location) => location && (location.state || location.country)
  );
  const firstRegion = firstLocation?.state;
  const firstCountry = firstLocation?.country;
  const facilities = values
    .slice(0, 12)
    .map((location) =>
      [location.facility, location.city, location.state, location.country]
        .filter(Boolean)
        .join(", ")
    )
    .filter(Boolean);

  const parts = [];
  if (states.length > 1 && countries.length === 1) {
    parts.push(`Location for form autofill: ${states.join(", ")}, ${countries[0]}`);
  } else if (firstRegion && firstCountry) {
    parts.push(`Primary location for form autofill: ${firstRegion}, ${firstCountry}`);
  } else if (firstCountry) {
    parts.push(`Primary location for form autofill: ${firstCountry}`);
  }
  if (countries.length) parts.push(`Countries: ${countries.join(", ")}`);
  if (states.length) parts.push(`States/regions: ${states.join(", ")}`);
  if (facilities.length) parts.push(`Sample facilities: ${facilities.join("; ")}`);
  if (values.length > facilities.length) {
    parts.push(`${values.length - facilities.length} additional locations omitted from extraction input.`);
  }
  return parts.join("\n");
}

function uniqueValues(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function looksLikeClinicalTrialText(text) {
  const lowerText = text.toLowerCase();
  let score = 0;
  for (const keyword of CLINICAL_TRIAL_KEYWORDS) {
    if (lowerText.includes(keyword)) score += 1;
  }
  if (/\bnct\d{8}\b/i.test(text)) score += 2;
  return score >= 2;
}

function reduceDocumentForExtraction(documentText) {
  if (documentText.length <= LARGE_DOCUMENT_CHARACTERS) {
    return {
      text: limitText(documentText, MAX_AGENT_INPUT_CHARACTERS),
      wasReduced: documentText.length > MAX_AGENT_INPUT_CHARACTERS,
    };
  }

  const selectedText = selectRelevantSections(documentText);
  return {
    text: limitText(selectedText || documentText, MAX_AGENT_INPUT_CHARACTERS),
    wasReduced: true,
  };
}

function selectRelevantSections(documentText) {
  const paragraphs = documentText
    .split(/\n\s*\n/)
    .map((paragraph) => normalizeWhitespace(paragraph))
    .filter(Boolean);
  const selectedIndexes = new Set();

  for (let index = 0; index < paragraphs.length; index += 1) {
    const lowerParagraph = paragraphs[index].toLowerCase();
    const isRelevant = RELEVANT_SECTION_KEYWORDS.some((keyword) =>
      lowerParagraph.includes(keyword)
    );
    if (!isRelevant) continue;

    selectedIndexes.add(index);
    for (let offset = 1; offset <= SECTION_FOLLOWING_PARAGRAPHS; offset += 1) {
      if (index + offset < paragraphs.length) selectedIndexes.add(index + offset);
    }
  }

  const selected = Array.from(selectedIndexes)
    .sort((a, b) => a - b)
    .map((index) => paragraphs[index]);

  const introduction = limitText(documentText, 2500);
  return normalizeWhitespace([introduction, ...selected].join("\n\n"));
}

function limitText(text, maxCharacters) {
  if (text.length <= maxCharacters) return text;
  const clipped = text.slice(0, maxCharacters);
  const lastParagraphBreak = clipped.lastIndexOf("\n\n");
  if (lastParagraphBreak > maxCharacters * 0.7) {
    return `${clipped.slice(0, lastParagraphBreak).trim()}\n\n[Document truncated to relevant clinical trial sections for extraction.]`;
  }
  return `${clipped.trim()}\n\n[Document truncated to relevant clinical trial sections for extraction.]`;
}

function requiredFieldsForSupplementalAgent(fieldResult) {
  const fields = fieldResult.extractedFields || {};
  return {
    trialName: fields.trialName || null,
    inclusionCriteria: {
      relatedConditions: fields.relatedConditions || null,
      pathology: fields.pathology || null,
      gender: fields.gender || null,
      ageRange: fields.ageRange || null,
    },
    exclusionCriteria: {
      bmiRange: fields.bmiRange || null,
      diseases: fields.diseases || null,
      surgeries: fields.surgeries || null,
      priorMedications: fields.priorMedications || null,
      pregnancy: fields.pregnancy || null,
    },
  };
}

async function extractTrialFields(file, options = {}) {
  const agents = {
    fieldExtractor: fieldExtractorAgent,
    supplementalCriteria: supplementalCriteriaAgent,
    ...(options.agents || {}),
  };
  const { documentText, source } = await prepareDocumentForExtraction(file);
  const fieldResult = await agents.fieldExtractor.extractFieldsFromText(documentText, source);

  let supplementalCriteria;
  try {
    supplementalCriteria = await agents.supplementalCriteria.extractSupplementalCriteriaFromText(
      documentText,
      requiredFieldsForSupplementalAgent(fieldResult),
      source
    );
  } catch (error) {
    console.error("Supplemental criteria extraction failed:", error.message);
    supplementalCriteria = {
      additionalTrialInformation: [],
      summary: "",
      missingOrAmbiguousCriteria: [],
      source: {
        ...source,
        extractor: "openai",
        model: fieldResult.source?.model || process.env.OPENAI_MODEL || "gpt-4.1-mini",
      },
      error: error.message,
    };
  }

  const fieldSource = fieldResult.source || {};
  const supplementalSource = supplementalCriteria.source || {};
  const extractionMetadata = {
    freshExtraction: true,
    documentFingerprint: source.documentFingerprint,
    preprocessingVersion: DOCUMENT_PREPROCESSING_VERSION,
    fieldExtractorVersion: fieldSource.fieldExtractorVersion || null,
    fieldExtractorSchemaVersion: fieldSource.fieldExtractorSchemaVersion || null,
    supplementalExtractorVersion:
      supplementalSource.supplementalExtractorVersion || null,
    supplementalExtractorSchemaVersion:
      supplementalSource.supplementalExtractorSchemaVersion || null,
    model: fieldSource.model || supplementalSource.model || null,
    fieldSystemFingerprint: fieldSource.systemFingerprint || null,
    supplementalSystemFingerprint: supplementalSource.systemFingerprint || null,
    agentsFreshlyExecuted: {
      fieldExtractor: true,
      supplementalCriteria: true,
    },
  };

  return {
    ...fieldResult,
    supplementalCriteria,
    extractionMetadata,
  };
}

module.exports = {
  DOCUMENT_PREPROCESSING_VERSION,
  extractTrialFields,
  limitText,
  normalizeWhitespace,
  prepareDocumentForExtraction,
  reduceDocumentForExtraction,
  shortDocumentFingerprint,
  stableJsonStringify,
};
