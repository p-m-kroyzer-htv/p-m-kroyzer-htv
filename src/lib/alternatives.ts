import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { claude, FALLBACK, MODEL, textOf } from "./claude";
import { db } from "./db";

export const Alternative = z.object({
  name: z.string(),
  kind: z.enum(["cheaper_plan", "competitor", "free", "bundle", "cancel"]),
  price_ils_monthly: z.number().nullable(),
  saving_ils_monthly: z.number().nullable(),
  why: z.string(),
  catch: z.string().nullable(),
  url: z.string().nullable(),
});
const Answer = z.object({ alternatives: z.array(Alternative).max(5), checked_at: z.string() });
export type Alternatives = z.infer<typeof Answer>;

const SYSTEM = `You help a person in Israel cut what they pay for subscriptions. You get one subscription they pay for: what it is, the plan, what it costs them per month in shekels, how much they say they use it, and the other subscriptions they already pay for.

Search the web for the CURRENT prices (today's, in Israel where the service prices by country) and suggest up to 4 realistic alternatives, best saving first:
- cheaper_plan: a cheaper tier or annual billing of the same service.
- competitor: another service that does the same job for less.
- free: a free option that genuinely covers the need.
- bundle: something they already pay for that includes this (e.g. Google One with YouTube, a phone plan with a streaming service). Check the list of their other subscriptions for overlap first.
- cancel: when they mark it "unused" or "rarely", say plainly that cancelling saves the full amount.

Only suggest what you verified in a source today; never invent a price. Every text field (why, catch) is in Hebrew, short, everyday words, never a long dash. catch is the real downside, or null.

Answer with ONLY a JSON object, no other text:
{"alternatives":[{"name":"","kind":"cheaper_plan|competitor|free|bundle|cancel","price_ils_monthly":0,"saving_ils_monthly":0,"why":"","catch":null,"url":null}],"checked_at":"YYYY-MM-DD"}`;

const USAGE_HE: Record<string, string> = {
  unknown: "לא סימן",
  daily: "כל יום",
  sometimes: "לפעמים",
  rarely: "לעיתים רחוקות",
  unused: "לא משתמש",
};

export interface SubscriptionBrief {
  name: string;
  vendor: string;
  plan: string | null;
  monthlyIls: number | null;
  usage: string;
  seats: number | null;
  others: string[];
}

function parseJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("לא התקבלה תשובה בפורמט הנכון");
  return JSON.parse(text.slice(start, end + 1));
}

export async function findAlternatives(sub: SubscriptionBrief): Promise<Alternatives> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content: [
        `Subscription: ${sub.name} (billed by ${sub.vendor})`,
        `Plan: ${sub.plan ?? "unknown"}`,
        `Costs them: ${sub.monthlyIls != null ? `${sub.monthlyIls} ILS per month` : "unknown"}`,
        sub.seats ? `Seats: ${sub.seats}` : "",
        `Usage (their own mark): ${USAGE_HE[sub.usage] ?? sub.usage}`,
        `Other subscriptions they pay for: ${sub.others.join(", ") || "none found"}`,
        `Today: ${new Date().toISOString().slice(0, 10)}`,
      ]
        .filter(Boolean)
        .join("\n"),
    },
  ];

  // Web search runs on Anthropic's side; a long search pauses the turn and is continued by sending it back.
  for (let round = 0; round < 4; round++) {
    const response = await claude().beta.messages.create({
      model: MODEL(),
      max_tokens: 16000,
      ...FALLBACK,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: SYSTEM,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 6, user_location: { type: "approximate", country: "IL" } }],
      messages,
    });
    if (response.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: response.content });
      continue;
    }
    if (response.stop_reason === "refusal") throw new Error("המודל סירב לבדוק חלופות");
    if (response.stop_reason === "max_tokens") throw new Error("התשובה נקטעה");
    return Answer.parse(parseJson(textOf(response.content)));
  }
  throw new Error("החיפוש לקח יותר מדי זמן, כדאי לנסות שוב");
}

export function saveAlternatives(subscriptionId: number, answer: Alternatives) {
  db()
    .prepare("UPDATE subscriptions SET alternatives_json = ?, alternatives_at = datetime('now') WHERE id = ?")
    .run(JSON.stringify(answer), subscriptionId);
}
