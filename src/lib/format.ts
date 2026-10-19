/** Labels and formatting shared by the screens. No server imports: client components use it too. */

export const USAGE_KEYS = ["unknown", "daily", "sometimes", "rarely", "unused"] as const;
export type Usage = (typeof USAGE_KEYS)[number];

export const USAGE_LABEL: Record<Usage, string> = {
  unknown: "לא סימן",
  daily: "כל יום",
  sometimes: "לפעמים",
  rarely: "לעיתים רחוקות",
  unused: "לא משתמש",
};

/** The design's short state names (data-s, .s-*). */
export const USAGE_CLASS: Record<Usage, string> = {
  unknown: "unk",
  daily: "daily",
  sometimes: "some",
  rarely: "rare",
  unused: "none",
};

/** Order of the leak meter: the leak first. */
export const METER_ORDER: Usage[] = ["unused", "rarely", "sometimes", "daily", "unknown"];

export const isLeak = (usage: string) => usage === "unused" || usage === "rarely";

export const asUsage = (value: string): Usage => ((USAGE_KEYS as readonly string[]).includes(value) ? (value as Usage) : "unknown");

export const PERIOD_LABEL: Record<string, string> = {
  monthly: "חודשי",
  yearly: "שנתי",
  quarterly: "רבעוני",
  weekly: "שבועי",
  one_time: "חד פעמי",
  unknown: "לא ידוע",
};

export const PER_LABEL: Record<string, string> = {
  monthly: "לחודש",
  yearly: "לשנה",
  quarterly: "לרבעון",
  weekly: "לשבוע",
};

export const ALT_KIND: Record<string, { cls: string; label: string }> = {
  free: { cls: "t-free", label: "חינם" },
  cheaper_plan: { cls: "t-cheap", label: "מסלול זול יותר" },
  competitor: { cls: "t-comp", label: "מתחרה" },
  bundle: { cls: "t-incl", label: "כבר כלול במנוי אחר שלך" },
  cancel: { cls: "t-cancel", label: "לבטל" },
};

export const CHARGE_TAG: Record<string, string> = {
  renewal_notice: "הודעת חידוש",
  trial_ending: "סוף תקופת ניסיון",
  price_change: "שינוי מחיר",
  cancellation: "ביטול",
};

export const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SYMBOL: Record<string, string> = { USD: "$", EUR: "€", GBP: "£" };

/** "$59.99", "€10.00" or "69.90" (the shekel sign is rendered apart, in .cur). */
export function originalParts(amount: number, currency: string | null): { text: string; shekel: boolean; code: string } {
  const code = (currency || "ILS").toUpperCase().replace("NIS", "ILS");
  if (code === "ILS") return { text: fmt(amount), shekel: true, code };
  const sym = SYMBOL[code];
  return { text: sym ? `${sym}${fmt(amount)}` : `${fmt(amount)} ${code}`, shekel: false, code };
}

/** "2026-10-03" to "03.10.2026". */
export function dateIL(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

const MONTHS = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יוני", "יולי", "אוג", "ספט", "אוק", "נוב", "דצמ"];
const MONTHS_LONG = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

export const monthShort = (iso: string) => MONTHS[Number(iso.slice(5, 7)) - 1];
export const monthYear = (iso: string) => `${MONTHS_LONG[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

/** Today in Israel, as "YYYY-MM-DD". */
export function todayIL(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());
}

export function daysUntil(iso: string, today = todayIL()): number {
  return Math.round((Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
}

/** A stored UTC "YYYY-MM-DD HH:MM:SS" as "היום 08:14", "אתמול 21:02" or "17.10.2026 08:14", Israel time. */
export function whenIL(utc: string | null): string {
  if (!utc) return "";
  const at = new Date(`${utc.replace(" ", "T")}Z`);
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(at);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" }).format(at);
  const diff = daysUntil(todayIL(), day);
  if (diff === 0) return `היום ${time}`;
  if (diff === 1) return `אתמול ${time}`;
  return `${dateIL(day)} ${time}`;
}

/** A steady hue per vendor, for the letter tile. */
export function hueOf(vendor: string): number {
  let h = 0;
  for (const ch of vendor.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

export const initial = (name: string) => (name.trim()[0] || "?").toUpperCase();

export const shortEmail = (email: string) => email.split("@")[0];

/** A link shown without its scheme: "adobe.com/plans". */
export const bareUrl = (url: string) => url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");

export const hrefOf = (url: string) => (/^https?:\/\//.test(url) ? url : `https://${url}`);
