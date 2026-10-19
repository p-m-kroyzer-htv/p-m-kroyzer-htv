/** Bank of Israel representative rates, cached for the process for 6 hours. */
const URL = "https://boi.org.il/PublicApi/GetExchangeRates";
const TTL_MS = 6 * 3600 * 1000;

let cache: { at: number; rates: Record<string, number> } | null = null;

export async function ilsRates(): Promise<Record<string, number>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.rates;
  const rates: Record<string, number> = { ILS: 1 };
  try {
    const res = await fetch(URL, { signal: AbortSignal.timeout(10000) });
    const json = (await res.json()) as {
      exchangeRates: { key: string; currentExchangeRate: number; unit: number }[];
    };
    for (const r of json.exchangeRates) rates[r.key] = r.currentExchangeRate / (r.unit || 1);
    cache = { at: Date.now(), rates };
  } catch (err) {
    console.error("Bank of Israel rates unavailable", err);
  }
  return rates;
}

export async function toIls(amount: number | null, currency: string | null): Promise<number | null> {
  if (amount == null) return null;
  const code = (currency || "ILS").toUpperCase().replace("NIS", "ILS");
  const rate = (await ilsRates())[code];
  return rate ? Math.round(amount * rate * 100) / 100 : null;
}
