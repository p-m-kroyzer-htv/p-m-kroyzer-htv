import Anthropic from "@anthropic-ai/sdk";
import { envOr } from "./env";

let client: Anthropic | null = null;

export function claude(): Anthropic {
  client ??= new Anthropic();
  return client;
}

export const MODEL = () => envOr("CLAUDE_MODEL", "claude-opus-5-5");

/**
 * Server-side refusal fallback: if the model declines a request on policy grounds,
 * the API retries it on its default fallback model inside the same call.
 */
export const FALLBACK = {
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default" as const,
};

export function textOf(content: Anthropic.Beta.BetaContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}
