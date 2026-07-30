function emptyToNull(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") {
    const normalized = value.replace(/\s+/g, " ").trim();
    return normalized === "" || normalized.toLowerCase() === "null"
      ? null
      : normalized;
  }
  return value;
}

function normalizeText(value) {
  const text = emptyToNull(value);
  if (text === null) return null;
  return String(text).replace(/\s+/g, " ").trim().toLowerCase();
}

function normalizeNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Number(number.toFixed(4));
}

function normalizeClinicalList(value) {
  const text = emptyToNull(value);
  if (text === null) return [];
  if (Array.isArray(text)) {
    return Array.from(
      new Set(text.flatMap((item) => normalizeClinicalList(item)))
    ).sort();
  }
  return Array.from(
    new Set(
      String(text)
        .split(/[,;\n]+/)
        .map(normalizeText)
        .filter(Boolean)
    )
  ).sort();
}

function normalizeAgeRange(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return {
      min: normalizeNumber(value.min),
      max: normalizeNumber(value.max),
    };
  }

  const text = emptyToNull(value);
  if (text === null) return { min: null, max: null };
  const raw = String(text);
  const numbers = raw.match(/\d+(?:\.\d+)?/g) || [];
  if (numbers.length >= 2) {
    return {
      min: normalizeNumber(numbers[0]),
      max: normalizeNumber(numbers[1]),
    };
  }
  if (numbers.length === 1) {
    const lower = raw.toLowerCase();
    if (/^\s*[-–—]\s*\d/.test(raw) || lower.includes("<")) {
      return { min: null, max: normalizeNumber(numbers[0]) };
    }
    return { min: normalizeNumber(numbers[0]), max: null };
  }
  return {
    min: null,
    max: null,
  };
}

function normalizeBmiRange(value) {
  const text = emptyToNull(value);
  if (text === null) return { min: null, max: null };

  const raw = String(text);
  const numbers = raw.match(/\d+(?:\.\d+)?/g)?.map(Number) || [];
  if (numbers.length >= 2) {
    return {
      min: normalizeNumber(Math.min(numbers[0], numbers[1])),
      max: normalizeNumber(Math.max(numbers[0], numbers[1])),
    };
  }
  if (numbers.length === 1) {
    if (raw.includes(">")) {
      return { min: normalizeNumber(numbers[0]), max: null };
    }
    if (raw.includes("<")) {
      return { min: null, max: normalizeNumber(numbers[0]) };
    }
  }
  return { min: null, max: null, raw: normalizeText(raw) };
}

function parseJson(value, fallback = {}) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
}

function medicationExclusions(exclusionCriteria = {}) {
  return (
    exclusionCriteria.PriorMedications ??
    exclusionCriteria["Prior Medications"] ??
    exclusionCriteria.priorMedications ??
    exclusionCriteria.prior_medications ??
    null
  );
}

function normalizeJson(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return normalizeText(value);
  if (typeof value === "number") return normalizeNumber(value);
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value
      .map(normalizeJson)
      .filter((item) => item !== null)
      .sort((a, b) => stableStringify(a).localeCompare(stableStringify(b)));
  }
  if (typeof value === "object") {
    const normalized = {};
    for (const key of Object.keys(value).sort()) {
      const item = normalizeJson(value[key]);
      if (item !== null) normalized[key] = item;
    }
    return normalized;
  }
  return normalizeText(value);
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
}

function normalizeSemanticCriteriaRow(row) {
  if (!row) return null;
  const criteriaJson = parseJson(row.criteria_json, {});
  return normalizeJson({
    sourceType: row.source_type ?? row.sourceType ?? null,
    summary: row.summary ?? null,
    criteriaJson,
  });
}

function semanticRowFromPayload(trialId, payload = {}) {
  return {
    trial_id: trialId,
    source_type: payload.sourceType || "manual_form",
    summary: payload.summary || "",
    criteria_json: {
      additionalTrialInformation: Array.isArray(
        payload.additionalTrialInformation
      )
        ? payload.additionalTrialInformation
        : [],
      missingOrAmbiguousCriteria: Array.isArray(
        payload.missingOrAmbiguousCriteria
      )
        ? payload.missingOrAmbiguousCriteria
        : [],
    },
  };
}

function criteriaSnapshotFromStored(trial, semanticCriteriaRow) {
  const exclusionCriteria = parseJson(trial.exclusion_criteria, {});
  return {
    relatedConditions: normalizeClinicalList(trial.related_conditions),
    pathology: normalizeClinicalList(trial.pathology),
    ageRange: normalizeAgeRange(trial.age_range),
    gender: normalizeText(trial.gender),
    exclusionCriteria: {
      bmi: normalizeBmiRange(exclusionCriteria.BMI),
      diseases: normalizeClinicalList(exclusionCriteria.Diseases),
      surgeries: normalizeClinicalList(exclusionCriteria.Surgeries),
      priorMedications: normalizeClinicalList(
        medicationExclusions(exclusionCriteria)
      ),
      pregnancy: normalizeText(exclusionCriteria.Pregnancy),
    },
    semanticCriteria: normalizeSemanticCriteriaRow(semanticCriteriaRow),
  };
}

function criteriaSnapshotFromIncoming(formData, semanticCriteriaRow) {
  return {
    relatedConditions: normalizeClinicalList(formData.relatedConditions),
    pathology: normalizeClinicalList(formData.pathology),
    ageRange: normalizeAgeRange(formData.ageRange),
    gender: normalizeText(formData.gender),
    exclusionCriteria: {
      bmi: normalizeBmiRange(formData.bmi),
      diseases: normalizeClinicalList(formData.diseases),
      surgeries: normalizeClinicalList(formData.surgeries),
      priorMedications: normalizeClinicalList(formData.priorMedications),
      pregnancy: normalizeText(formData.pregnancy),
    },
    semanticCriteria: normalizeSemanticCriteriaRow(semanticCriteriaRow),
  };
}

function hasCriteriaChanged(oldSnapshot, nextSnapshot) {
  return stableStringify(oldSnapshot) !== stableStringify(nextSnapshot);
}

module.exports = {
  criteriaSnapshotFromIncoming,
  criteriaSnapshotFromStored,
  hasCriteriaChanged,
  medicationExclusions,
  normalizeAgeRange,
  normalizeBmiRange,
  normalizeClinicalList,
  normalizeSemanticCriteriaRow,
  normalizeText,
  semanticRowFromPayload,
  stableStringify,
};
