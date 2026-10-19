"use client";

/** A JSON call to the app's own API. Throws with the server's Hebrew message on failure. */
export async function api<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 401) {
    window.location.href = "/login";
    throw new ApiError("צריך להתחבר", res.status, json);
  }
  if (!res.ok) throw new ApiError(json.error || "משהו השתבש, אפשר לנסות שוב", res.status, json);
  return json as T;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body: Record<string, unknown>,
  ) {
    super(message);
  }
}
