const express = require("express");
const multer = require("multer");
const clinicalTrialPocController = require("../controllers/clinicalTrialPocController");

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

router.post(
  "/extract-trial-fields",
  upload.single("file"),
  clinicalTrialPocController.extractTrialFields
);

router.post(
  "/extract-manual-supplemental-criteria",
  clinicalTrialPocController.extractManualSupplementalCriteria
);

router.post("/save-semantic-criteria", clinicalTrialPocController.saveSemanticCriteria);

router.get("/semantic-criteria/:trialId", clinicalTrialPocController.getSemanticCriteria);

router.post("/deterministic-match", clinicalTrialPocController.getDeterministicMatch);

router.post("/semantic-compare", clinicalTrialPocController.getSemanticComparison);

router.get("/semantic-compare/:trialId", clinicalTrialPocController.getSemanticComparisonDebug);

router.post("/score-eligibility", clinicalTrialPocController.scoreEligibility);

router.get("/full-match-debug/:trialId", clinicalTrialPocController.getFullMatchDebug);

router.post("/explain-recommend", clinicalTrialPocController.explainRecommend);

router.get("/ranked-patients/:trialId", clinicalTrialPocController.getStoredRankedPatients);

router.post("/ranked-patients", clinicalTrialPocController.getRankedPatients);

router.post("/update-trial", clinicalTrialPocController.updateTrial);

router.post("/delete-trial", clinicalTrialPocController.deleteTrial);

module.exports = router;
