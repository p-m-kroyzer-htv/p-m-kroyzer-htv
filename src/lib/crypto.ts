import crypto from "node:crypto";
import { env } from "./env";

function key(purpose: string): Buffer {
  return crypto.createHash("sha256").update(`${purpose}:${env("APP_SECRET")}`).digest();
}

/** AES-256-GCM: iv.tag.ciphertext, base64url */
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key("enc"), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(packed: string): string {
  const [iv, tag, data] = packed.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", key("enc"), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function sign(value: string): string {
  const mac = crypto.createHmac("sha256", key("sign")).update(value).digest("base64url");
  return `${value}.${mac}`;
}

/** Returns the signed value, or null when the signature does not match. */
export function unsign(signed: string | undefined): string | null {
  if (!signed) return null;
  const dot = signed.lastIndexOf(".");
  if (dot < 0) return null;
  const value = signed.slice(0, dot);
  const expected = Buffer.from(sign(value));
  const given = Buffer.from(signed);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given) ? value : null;
}

export function safeEqual(a: string, b: string): boolean {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}
