import { z } from "zod";
import { claude, FALLBACK, MODEL, textOf } from "./claude";

export const PERIODS = ["monthly", "yearly", "quarterly", "weekly", "one_time", "unknown"] as const;
export const KINDS = ["charge", "renewal_notice", "trial_ending", "price_change", "cancellation", "other"] as const;

const Extraction = z.object({
  is_subscription: z.boolean(),
  kind: z.enum(KINDS),
  vendor: z.string(),
  service: z.string(),
  plan: z.string().nullable(),
  amount: z.number().nullable(),
  currency: z.string().nullable(),
  billing_period: z.enum(PERIODS),
  charge_date: z.string().nullable(),
  next_renewal_date: z.string().nullable(),
  seats: z.number().int().nullable(),
  category: z.string(),
  manage_url: z.string().nullable(),
});
export type Extraction = z.infer<typeof Extraction>;

const nullable = (type: string) => ({ anyOf: [{ type }, { type: "null" }] });

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: Object.keys(Extraction.shape),
  properties: {
    is_subscription: { type: "boolean" },
    kind: { type: "string", enum: [...KINDS] },
    vendor: { type: "string" },
    service: { type: "string" },
    plan: nullable("string"),
    amount: nullable("number"),
    currency: nullable("string"),
    billing_period: { type: "string", enum: [...PERIODS] },
    charge_date: nullable("string"),
    next_renewal_date: nullable("string"),
    seats: nullable("integer"),
    category: { type: "string" },
    manage_url: nullable("string"),
  },
};

const SYSTEM = `You read one email from a person's personal mailbox and decide whether it is about a paid recurring subscription (a streaming service, software, cloud storage, an AI tool, a membership, a phone or internet plan, a newspaper and so on).

is_subscription is true only for: a receipt or invoice for a recurring charge, a notice that a subscription will renew or a trial will turn paid, a price change of a subscription, or a cancellation confirmation. A one-time purchase, an order from a shop, a marketing email, a newsletter, a bank statement or a failed-login alert is not a subscription: is_subscription false, kind "other".

Fields:
- vendor: the company that charges (e.g. "Google", "Apple", "Netflix"). service: the product the person pays for (e.g. "YouTube Premium", "iCloud+", "Netflix"). When Apple or Google bills for a third-party app, service is that app.
- plan: the plan or tier as written, else null.
- amount: the total charged or about to be charged, a plain number. currency: ISO 4217 code (ILS for ₪ / ש"ח / NIS).
- billing_period: from the email's wording; "unknown" if it does not say.
- charge_date / next_renewal_date: YYYY-MM-DD, else null. If the email says only "renews on" a date, that is next_renewal_date.
- seats: number of users or licenses if stated, else null.
- category: one short Hebrew word or two (e.g. "סטרימינג", "מוזיקה", "אחסון ענן", "כלי AI", "תוכנה", "עיצוב", "תקשורת", "חדשות", "כושר").
- manage_url: a link from the email to manage or cancel the subscription, else null.

Never guess an amount that is not in the email. For a non-subscription email fill the text fields with "" and the rest with null / "unknown".`;

export interface MailInput {
  from: string;
  subject: string;
  receivedAt: string;
  body: string;
}

export async function extractSubscription(mail: MailInput): Promise<Extraction> {
  const response = await claude().beta.messages.create({
    model: MODEL(),
    max_tokens: 4000,
    ...FALLBACK,
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `From: ${mail.from}\nSubject: ${mail.subject}\nReceived: ${mail.receivedAt}\n\n${mail.body}`,
      },
    ],
  });
  if (response.stop_reason === "refusal") throw new Error("המודל סירב לקרוא את המייל");
  if (response.stop_reason === "max_tokens") throw new Error("התשובה נקטעה");
  return Extraction.parse(JSON.parse(textOf(response.content)));
}
