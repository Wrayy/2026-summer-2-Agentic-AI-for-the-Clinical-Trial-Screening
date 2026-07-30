const fs = require("fs");
const path = require("path");

const controllerPath = path.join(
  __dirname,
  "..",
  "app",
  "controllers",
  "clinicalTrialPocController.js"
);
const source = fs.readFileSync(controllerPath, "utf8");

function assertIncludes(needle, description) {
  if (!source.includes(needle)) {
    throw new Error(`Missing ${description}: ${needle}`);
  }
}

assertIncludes("const MATCH_NEXT_PATIENT_LIMIT = 10;", "server batch-size cap");
assertIncludes("getPatientIdsForMatchingMode", "matching mode selector");
assertIncludes("WHERE mr.patient_id IS NULL", "unmatched-patient filter");
assertIncludes("ORDER BY pr.id", "stable patient ordering");
assertIncludes("mode === \"all\" ? \"all\" : \"next\"", "mode allow-list");
assertIncludes("requestedCount", "matching result counts");
assertIncludes("failedCount", "matching failure count");

if (source.includes("excludePatientIds")) {
  throw new Error("ranked-patients must not trust client excludePatientIds.");
}

if (source.includes("const { trialId, patientIds, limit")) {
  throw new Error("ranked-patients must not trust an arbitrary client limit.");
}

console.log("Matching mode validation passed.");
