import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../logger.js";
import {
  type RelocationSummaryInput,
  type RelocationSummaryOutput,
  RelocationSummaryOutputSchema,
} from "./ai-router-schemas.js";

// ─── Model ────────────────────────────────────────────────────────────────────

export const OPENAI_RELOCATION_MODEL = process.env.AI_MODEL_MAIN ?? "gpt-5.2";

// ─── Prompts ──────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a relocation intelligence assistant for a job marketplace.
Your task: write a concise, honest, candidate-facing summary of a relocation opportunity.

RULES:
- Write for the candidate — they are considering relocating for this job
- Be direct and realistic, not promotional
- Use plain English, not jargon
- Never guarantee outcomes — use likelihood/estimate language
- If data is missing, say so clearly rather than fabricating
- Return ONLY valid JSON with exactly the fields specified, no markdown, no extra keys`;

function buildUserPrompt(input: RelocationSummaryInput): string {
  const location = [input.city, input.country].filter(Boolean).join(", ") || "the target location";
  const hasFinancial = input.estimatedMonthlyNet !== null && input.estimatedMonthlyCost !== null;

  const financialBlock = hasFinancial
    ? `Estimated monthly gross: ${input.estimatedMonthlyGross ?? "unknown"}
Estimated monthly net (after tax): ${input.estimatedMonthlyNet}
Estimated monthly living cost: ${input.estimatedMonthlyCost}
Estimated monthly surplus: ${input.estimatedMonthlySurplus ?? "unknown"}`
    : "Salary data is missing or incomplete — financial assessment is not possible.";

  return `Relocation analysis for: ${input.jobTitle} at ${input.company || "an employer"} in ${location}

Score: ${input.relocationScore}/100
Recommendation: ${input.relocationRecommendation}
Risk flags: ${input.riskFlags.length > 0 ? input.riskFlags.join(", ") : "none"}
Positive factors: ${input.positiveFactors.length > 0 ? input.positiveFactors.join(", ") : "none"}
${financialBlock}

Write a candidate-facing relocation summary. Return ONLY this JSON (no markdown):
{
  "summary": "<2-3 sentence plain-English overview of the relocation opportunity>",
  "mainUpside": "<1 sentence: the single strongest positive for this move>",
  "mainRisk": "<1 sentence: the most significant risk or concern>",
  "candidateAdvice": "<1-2 sentences of direct, actionable advice for the candidate>",
  "confidenceNote": "<1 sentence caveat about data quality and what the candidate should verify>"
}`;
}

// ─── Provider function ────────────────────────────────────────────────────────

export async function generateRelocationSummaryWithOpenAI(
  input: RelocationSummaryInput,
): Promise<{ output: RelocationSummaryOutput; model: string } | null> {
  try {
    const completion = await openai.chat.completions.create({
      model: OPENAI_RELOCATION_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input) },
      ],
      max_tokens: 600,
      temperature: 0.4,
      response_format: { type: "json_object" },
    });

    const rawText = completion.choices[0]?.message?.content ?? "";
    const parsed = JSON.parse(rawText) as unknown;
    const validated = RelocationSummaryOutputSchema.parse(parsed);

    return { output: validated, model: OPENAI_RELOCATION_MODEL };
  } catch (err) {
    logger.warn({ err }, "OpenAI relocation summary failed — will try fallback");
    return null;
  }
}
