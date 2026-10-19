import type { GmailMessage, GmailPart } from "./google";

/** Receipts are short; anything past this is footers and legal text. */
const MAX_BODY_CHARS = 15000;

function decode(data: string): string {
  return Buffer.from(data, "base64url").toString("utf8");
}

function findPart(part: GmailPart, mime: string): GmailPart | null {
  if (part.mimeType === mime && part.body?.data) return part;
  for (const child of part.parts ?? []) {
    const hit = findPart(child, mime);
    if (hit) return hit;
  }
  return null;
}

const ENTITIES: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'" };

export function htmlToText(html: string): string {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d|table)>/gi, "\n")
    .replace(/<td[^>]*>/gi, " | ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#?\w+);/g, (m, e: string) =>
      ENTITIES[e] ?? (e.startsWith("#") ? String.fromCodePoint(Number(e.slice(1).replace(/^x/, "0x"))) : m),
    )
    .replace(/[ \t ]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

export function readMessage(msg: GmailMessage) {
  const header = (name: string) =>
    msg.payload.headers?.find((h) => h.name.toLowerCase() === name)?.value ?? "";
  const plain = findPart(msg.payload, "text/plain");
  const html = findPart(msg.payload, "text/html");
  let body = "";
  if (html?.body?.data) body = htmlToText(decode(html.body.data));
  if (body.length < 40 && plain?.body?.data) body = decode(plain.body.data).trim();
  return {
    from: header("from"),
    subject: header("subject"),
    receivedAt: new Date(Number(msg.internalDate)).toISOString(),
    body: body.slice(0, MAX_BODY_CHARS),
  };
}
