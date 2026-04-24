import { logger } from "../logger.js";
import { generateRelocationSummaryWithOpenAI, OPENAI_RELOCATION_MODEL } from "./openai-provider.js";
import { generateRelocationSummaryWithClaude, ANTHROPIC_RELOCATION_MODEL } from "./anthropic-provider.js";
import type {
  AiProviderName,
  RelocationSummaryInput,
  RelocationSummaryOutput,
} from "./ai-router-schemas.js";

// ─── Result type ──────────────────────────────────────────────────────────────

export interface AiRouterResult<T> {
  output: T;
  provider: AiProviderName;
  model: string | null;
  latencyMs: number;
  fromFallback: boolean;
}

// ─── Relocation summary router ────────────────────────────────────────────────
// Strategy: OpenAI (gpt-5.2) → Claude (claude-sonnet-4-6) → deterministic stub
// Each provider catches its own errors and returns null on failure.

export async function routeRelocationSummary(
  input: RelocationSummaryInput,
  deterministicFallback: () => RelocationSummaryOutput,
): Promise<AiRouterResult<RelocationSummaryOutput>> {
  const start = Date.now();

  // ── 1. OpenAI ──────────────────────────────────────────────────────────────
  try {
    const result = await generateRelocationSummaryWithOpenAI(input);
    if (result) {
      return {
        output: result.output,
        provider: "openai",
        model: result.model,
        latencyMs: Date.now() - start,
        fromFallback: false,
      };
    }
  } catch (err) {
    logger.warn({ err }, "AI router: OpenAI attempt threw unexpectedly");
  }

  // ── 2. Claude fallback ────────────────────────────────────────────────────
  try {
    const result = await generateRelocationSummaryWithClaude(input);
    if (result) {
      logger.info("AI router: fell back to Claude for relocation summary");
      return {
        output: result.output,
        provider: "anthropic",
        model: result.model,
        latencyMs: Date.now() - start,
        fromFallback: true,
      };
    }
  } catch (err) {
    logger.warn({ err }, "AI router: Claude attempt threw unexpectedly");
  }

  // ── 3. Deterministic fallback ─────────────────────────────────────────────
  logger.warn("AI router: both AI providers failed — using deterministic relocation summary");
  return {
    output: deterministicFallback(),
    provider: "deterministic",
    model: null,
    latencyMs: Date.now() - start,
    fromFallback: true,
  };
}
