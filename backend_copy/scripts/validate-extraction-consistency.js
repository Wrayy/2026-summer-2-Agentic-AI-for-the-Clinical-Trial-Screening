const assert = require("assert");
const {
  extractTrialFields,
  normalizeWhitespace,
  prepareDocumentForExtraction,
  reduceDocumentForExtraction,
} = require("../app/services/clinicalTrialDocumentExtractorService");
const fieldExtractorAgent = require("../app/services/agents/fieldExtractorAgent");
const supplementalCriteriaAgent = require("../app/services/agents/supplementalCriteriaAgent");

function file(name, mimetype, text) {
  return {
    originalname: name,
    mimetype,
    buffer: Buffer.from(text, "utf8"),
  };
}

function clinicalText(extra = "") {
  return [
    "Clinical Trial",
    "Official Title: Example Hypertension Study",
    "Brief Summary: This study evaluates an intervention in adults with hypertension.",
    "Eligibility Criteria: Inclusion Criteria: adults aged 18 to 75 with hypertension.",
    "Exclusion Criteria: pregnancy, recent surgery, BMI above 40.",
    "Phase: Phase 2",
    extra,
  ]
    .filter(Boolean)
    .join("\n");
}

async function main() {
  const lf = clinicalText("Locations: Ontario, Canada\nSponsor: Standalone Pharma");
  const crlf = lf.replace(/\n/g, "\r\n");
  assert.strictEqual(normalizeWhitespace(lf), normalizeWhitespace(crlf));

  const preparedA = await prepareDocumentForExtraction(
    file("first.txt", "text/plain", lf)
  );
  const preparedB = await prepareDocumentForExtraction(
    file("second.txt", "text/plain", crlf)
  );
  assert.strictEqual(preparedA.documentText, preparedB.documentText);
  assert.strictEqual(
    preparedA.source.documentFingerprint,
    preparedB.source.documentFingerprint,
    "different filenames with identical content should fingerprint identically"
  );

  const jsonA = JSON.stringify({
    protocolSection: {
      eligibilityModule: {
        eligibilityCriteria: "Inclusion Criteria: hypertension. Exclusion Criteria: pregnancy.",
        minimumAge: "18 Years",
        maximumAge: "75 Years",
        sex: "All",
      },
      identificationModule: {
        officialTitle: "Example Official Title",
        briefTitle: "Example Brief Title",
        nctId: "NCT12345678",
      },
      descriptionModule: {
        briefSummary: "Clinical trial summary.",
      },
      conditionsModule: {
        conditions: ["Hypertension"],
      },
      designModule: {
        studyType: "Interventional",
        phases: ["Phase 2"],
      },
    },
  });
  const jsonB = JSON.stringify({
    protocolSection: {
      designModule: {
        phases: ["Phase 2"],
        studyType: "Interventional",
      },
      conditionsModule: {
        conditions: ["Hypertension"],
      },
      descriptionModule: {
        briefSummary: "Clinical trial summary.",
      },
      identificationModule: {
        nctId: "NCT12345678",
        briefTitle: "Example Brief Title",
        officialTitle: "Example Official Title",
      },
      eligibilityModule: {
        sex: "All",
        maximumAge: "75 Years",
        minimumAge: "18 Years",
        eligibilityCriteria: "Inclusion Criteria: hypertension. Exclusion Criteria: pregnancy.",
      },
    },
  });
  const preparedJsonA = await prepareDocumentForExtraction(
    file("a.json", "application/json", jsonA)
  );
  const preparedJsonB = await prepareDocumentForExtraction(
    file("b.json", "application/json", jsonB)
  );
  assert.strictEqual(preparedJsonA.documentText, preparedJsonB.documentText);

  const longDocument = [
    clinicalText(),
    ...Array.from({ length: 1600 }, (_, index) =>
      index % 100 === 0
        ? `Eligibility paragraph ${index}: Inclusion Criteria details remain stable.`
        : `Background paragraph ${index}: operational text.`
    ),
  ].join("\n\n");
  assert.strictEqual(
    reduceDocumentForExtraction(longDocument).text,
    reduceDocumentForExtraction(longDocument).text,
    "reduction and truncation should be stable"
  );

  assert.deepStrictEqual(
    fieldExtractorAgent.normalizeFields({
      relatedConditions: "Hypertension; hypertension\nCardiovascular disease",
      pathology: ["Hypertension", " hypertension "],
      priorMedications: "Warfarin, warfarin",
    }),
    fieldExtractorAgent.normalizeFields({
      relatedConditions: ["Hypertension", "Cardiovascular disease"],
      pathology: "Hypertension",
      priorMedications: ["Warfarin"],
    }),
    "equivalent structured list fields should normalize identically"
  );
  assert.deepStrictEqual(
    fieldExtractorAgent.normalizeAgeRangeValue({ min: "18 Years", max: "75 Years" }).value,
    "18-75"
  );
  assert.deepStrictEqual(
    fieldExtractorAgent.normalizeBmiRangeValue("18 to 40").value,
    "> 18 and < 40"
  );

  const normalizedSupplemental = supplementalCriteriaAgent.ensureAdditionalInformation([
    {
      category: "Laboratory Thresholds",
      criterion: "eGFR must be at least 45",
      relevance: "High",
    },
    {
      category: "lab",
      criterion: " eGFR   must be at least 45 ",
      relevance: "High",
    },
    {
      category: "Medication Stability",
      criterion: "Stable antihypertensive therapy for 4 weeks",
      relevance: "Medium",
    },
  ]);
  assert.strictEqual(normalizedSupplemental.length, 2);
  assert.strictEqual(normalizedSupplemental[0].category, "Required medication or medication stability");
  assert.strictEqual(normalizedSupplemental[1].category, "Laboratory thresholds");

  let fieldCalls = 0;
  let supplementalCalls = 0;
  const fieldInputs = [];
  const supplementalInputs = [];
  const agents = {
    fieldExtractor: {
      async extractFieldsFromText(documentText, source) {
        fieldCalls += 1;
        fieldInputs.push(documentText);
        return {
          extractedFields: {
            trialName: "Mock Trial",
            trialId: "1234",
            relatedConditions: "Hypertension",
          },
          missingRequiredFields: [],
          fieldsNeedingReview: [],
          confidence: { overall: 1, fieldNotes: [] },
          source: {
            ...source,
            extractor: "mock",
            model: "mock-model",
            fieldExtractorVersion: "mock-field-v1",
            fieldExtractorSchemaVersion: "mock-field-schema-v1",
          },
        };
      },
    },
    supplementalCriteria: {
      async extractSupplementalCriteriaFromText(documentText, _requiredFields, source) {
        supplementalCalls += 1;
        supplementalInputs.push(documentText);
        if (supplementalCalls === 3) {
          throw new Error("intentional second-run supplemental failure");
        }
        return {
          additionalTrialInformation: [
            {
              category: "Laboratory thresholds",
              criterion: `Fresh criterion run ${supplementalCalls}`,
              sourceText: null,
              relevance: "High",
              notes: null,
            },
          ],
          summary: `fresh run ${supplementalCalls}`,
          missingOrAmbiguousCriteria: [],
          source: {
            ...source,
            extractor: "mock",
            model: "mock-model",
            supplementalExtractorVersion: "mock-supplemental-v1",
            supplementalExtractorSchemaVersion: "mock-supplemental-schema-v1",
          },
        };
      },
    },
  };

  const first = await extractTrialFields(file("same-a.txt", "text/plain", lf), {
    agents,
  });
  const second = await extractTrialFields(file("same-b.txt", "text/plain", lf), {
    agents,
  });
  const failedSupplemental = await extractTrialFields(
    file("same-c.txt", "text/plain", lf),
    { agents }
  );

  assert.strictEqual(fieldCalls, 3);
  assert.strictEqual(supplementalCalls, 3);
  assert.strictEqual(fieldInputs[0], fieldInputs[1]);
  assert.strictEqual(supplementalInputs[0], supplementalInputs[1]);
  assert.strictEqual(first.extractionMetadata.freshExtraction, true);
  assert.strictEqual(second.extractionMetadata.freshExtraction, true);
  assert.strictEqual(
    first.extractionMetadata.documentFingerprint,
    second.extractionMetadata.documentFingerprint
  );
  assert.notStrictEqual(
    first.supplementalCriteria.summary,
    second.supplementalCriteria.summary,
    "mock outputs prove the second run is fresh, not reused"
  );
  assert.strictEqual(
    failedSupplemental.supplementalCriteria.error,
    "intentional second-run supplemental failure"
  );

  console.log("Extraction consistency validation passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
