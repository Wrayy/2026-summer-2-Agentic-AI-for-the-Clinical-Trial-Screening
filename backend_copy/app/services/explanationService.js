const explanationAgent = require("./agents/explanationAgent");

// The LLM writes the free-form explanation and detailed suggested actions,
// but the primary action button shown in the dashboard is derived
// deterministically from status, not from the model - this guarantees the
// UI always shows one of a small, consistent set of actions instead of the
// model inventing arbitrary verbs each time.
const PRIMARY_ACTION_BY_STATUS = {
  "Strong Match": "Invite Patient",
  "Likely Match": "Invite Patient",
  "Needs Review": "Confirm Details",
  "Weak Match": "Do Not Invite",
  "Not Eligible": "Do Not Invite",
};

function primaryActionForStatus(status) {
  return PRIMARY_ACTION_BY_STATUS[status] || "Confirm Details";
}

async function generateExplanationsForPatients(patients) {
  const results = [];

  for (const patient of patients) {
    try {
      const { explanation, suggestedActions } = await explanationAgent.generateExplanation({
        patientName: patient.patientName,
        score: patient.score,
        status: patient.status,
        scoreBreakdown: patient.scoreBreakdown,
        deterministicResult: patient.deterministicResult,
        semanticComparison: patient.semanticComparison,
      });
      results.push({
        patientId: patient.patientId,
        patientName: patient.patientName,
        score: patient.score,
        status: patient.status,
        primaryAction: primaryActionForStatus(patient.status),
        explanation,
        suggestedActions,
      });
    } catch (error) {
      console.error(
        `Explanation generation failed for patient_id=${patient.patientId}:`,
        error.message
      );
      results.push({
        patientId: patient.patientId,
        patientName: patient.patientName,
        score: patient.score,
        status: patient.status,
        primaryAction: primaryActionForStatus(patient.status),
        explanation: "",
        suggestedActions: [],
        error: error.message,
      });
    }
  }

  return { patients: results };
}

module.exports = {
  generateExplanationsForPatients,
  primaryActionForStatus,
};
