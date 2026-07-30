function modelName() {
  return process.env.OPENAI_MODEL || "gpt-4.1-mini";
}

function ensureStringList(raw, max = 3) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => String(item || "").trim())
    .filter((item) => item.length > 0)
    .slice(0, max);
}

function summarizedInput({ patientName, score, status, scoreBreakdown, deterministicResult, semanticComparison }) {
  return JSON.stringify(
    {
      patientName,
      score,
      status,
      scoreBreakdown: {
        deterministicContribution: scoreBreakdown?.deterministicContribution ?? null,
        semanticContribution: scoreBreakdown?.semanticContribution ?? null,
        objectiveEligibilityContribution:
          scoreBreakdown?.objectiveEligibilityContribution ?? null,
        coreClinicalFitContribution:
          scoreBreakdown?.coreClinicalFitContribution ?? null,
        clinicalExclusionSafetyContribution:
          scoreBreakdown?.clinicalExclusionSafetyContribution ?? null,
        additionalCriteriaFitContribution:
          scoreBreakdown?.additionalCriteriaFitContribution ?? null,
        penalties: scoreBreakdown?.penalties || [],
      },
      deterministicResult: {
        matchedFields: deterministicResult?.matchedFields || [],
        failedFields: deterministicResult?.failedFields || [],
        missingFields: deterministicResult?.missingFields || [],
        hardExclusionFlags: deterministicResult?.hardExclusionFlags || [],
      },
      semanticComparison: semanticComparison
        ? {
            summary: semanticComparison.summary || null,
            supportingFactors: semanticComparison.supportingFactors || [],
            potentialConflicts: semanticComparison.potentialConflicts || [],
            missingInformation: semanticComparison.missingInformation || [],
            concerns: semanticComparison.concerns || [],
            criteriaAssessments: semanticComparison.criteriaAssessments || [],
          }
        : null,
    },
    null,
    2
  );
}

function explanationPrompt(input) {
  return [
    {
      role: "system",
      content:
        "You are the Explanation and Recommendation Agent for an e-Hospital clinical trials POC. You explain an already-computed eligibility score and status to a human clinical trial coordinator, using the deterministic match detail and semantic comparison detail given to you. You do not recompute, change, or second-guess the score or status - you explain why it came out the way it did. You never state or imply a final medical or enrollment decision; this is a screening aid and a human must review and confirm before any action is taken. Return strict JSON only.",
    },
    {
      role: "user",
      content: `Explain this patient's computed eligibility result and suggest next steps for a clinical trial coordinator.

${summarizedInput(input)}

Rules:
- Base the explanation only on the score, status, deterministic detail, and semantic detail given above; do not invent new clinical facts.
- Reference the specific deterministic and/or semantic factors that actually drove this result (e.g. a hard exclusion, a specific supporting factor, a specific conflict) rather than a generic restatement of the score.
- Keep "explanation" to 1-2 concise sentences.
- Do not repeat the numeric score, match status, or suggested next steps in "explanation"; those fields are already shown elsewhere in the dashboard.
- Keep all coordinator action instructions only in "suggestedActions", not in "explanation".
- Focus the explanation on the clinical rationale: what supports the match, what creates concern, and what missing information matters.
- "suggestedActions" are concrete next steps for a coordinator (for example, confirming a specific lab value with the patient's physician, or requesting updated records), not a restatement of the status. Provide 1-3 items.
- Never state or imply that this patient is definitively eligible or ineligible for enrollment; frame everything as input to a human reviewer's decision.

Return JSON with this exact top-level shape:
{
  "explanation": "string",
  "suggestedActions": ["string"]
}`,
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

async function callOpenAiExplanationAgent(input) {
  if (!process.env.OPENAI_API_KEY) {
    const error = new Error(
      "Explanation and Recommendation Agent requires OPENAI_API_KEY in backend_copy/.env."
    );
    error.statusCode = 503;
    throw error;
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: modelName(),
      messages: explanationPrompt(input),
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      body.error && body.error.message
        ? body.error.message
        : "OpenAI explanation request failed.";
    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }

  const content = body.choices?.[0]?.message?.content;
  if (!content) {
    const error = new Error("OpenAI explanation request returned an empty response.");
    error.statusCode = 502;
    throw error;
  }

  return parseJsonContent(content);
}

async function generateExplanation(input) {
  const llmResult = await callOpenAiExplanationAgent(input);

  return {
    explanation: String(llmResult.explanation || "").trim(),
    suggestedActions: ensureStringList(llmResult.suggestedActions),
  };
}

module.exports = {
  generateExplanation,
};
