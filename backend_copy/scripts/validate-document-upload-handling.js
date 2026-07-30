const assert = require("assert");
const {
  prepareDocumentForExtraction,
} = require("../app/services/clinicalTrialDocumentExtractorService");

function file(name, mimetype, text) {
  return {
    originalname: name,
    mimetype,
    buffer: Buffer.from(text, "utf8"),
  };
}

function fileFromBuffer(name, mimetype, buffer) {
  return {
    originalname: name,
    mimetype,
    buffer,
  };
}

async function expectError(label, action, errorCode) {
  try {
    await action();
  } catch (error) {
    assert.strictEqual(error.errorCode, errorCode, label);
    return;
  }
  throw new Error(`${label}: expected ${errorCode}`);
}

async function main() {
  const validClinicalTrialsGovJson = JSON.stringify({
    protocolSection: {
      identificationModule: {
        nctId: "NCT05769608",
        briefTitle: "A Clinical Trial of Example Treatment",
        officialTitle: "An Example Interventional Clinical Trial",
      },
      descriptionModule: {
        briefSummary: "This study evaluates an intervention in adults.",
      },
      conditionsModule: {
        conditions: ["Diabetes Mellitus"],
      },
      designModule: {
        studyType: "Interventional",
        phases: ["Phase 2"],
        enrollmentInfo: { count: 120, type: "Anticipated" },
      },
      eligibilityModule: {
        eligibilityCriteria:
          "Inclusion Criteria: adults with diabetes. Exclusion Criteria: pregnancy.",
        sex: "All",
        minimumAge: "18 Years",
        maximumAge: "75 Years",
      },
      contactsLocationsModule: {
        locations: [
          { facility: "First Site", city: "Birmingham", state: "Alabama", country: "United States" },
          { facility: "Second Site", city: "Mesa", state: "Arizona", country: "United States" },
        ],
      },
      armsInterventionsModule: {
        interventions: [{ name: "Example Treatment", type: "Drug" }],
      },
      outcomesModule: {
        primaryOutcomes: [{ measure: "Change in HbA1c", timeFrame: "12 weeks" }],
      },
    },
  });

  const prepared = await prepareDocumentForExtraction(
    file("NCT05769608.json", "application/json", validClinicalTrialsGovJson)
  );
  assert(prepared.documentText.includes("NCT05769608"));
  assert(prepared.documentText.includes("Eligibility Criteria"));
  assert(prepared.documentText.includes("Location for form autofill: Alabama, Arizona, United States"));
  assert.strictEqual(prepared.source.fileKind, "json");
  assert.strictEqual(prepared.source.wasReduced, true);

  const utf16Prepared = await prepareDocumentForExtraction(
    fileFromBuffer(
      "NCT05769608_formatted.json",
      "application/json",
      Buffer.concat([
        Buffer.from([0xff, 0xfe]),
        Buffer.from(validClinicalTrialsGovJson, "utf16le"),
      ])
    )
  );
  assert(utf16Prepared.documentText.includes("NCT05769608"));
  assert.strictEqual(utf16Prepared.source.textEncoding, "utf-16le");

  await expectError(
    "invalid json",
    () => prepareDocumentForExtraction(file("bad.json", "application/json", "{not valid")),
    "INVALID_JSON"
  );

  await expectError(
    "non clinical json",
    () =>
      prepareDocumentForExtraction(
        file("notes.json", "application/json", JSON.stringify({ hello: "world" }))
      ),
    "CLINICAL_TRIAL_FIELDS_NOT_FOUND"
  );

  await expectError(
    "empty text",
    () => prepareDocumentForExtraction(file("empty.txt", "text/plain", "")),
    "DOCUMENT_NO_READABLE_TEXT"
  );

  console.log("Document upload handling validation passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
