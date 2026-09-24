export class ApiError extends Error {
  constructor(public status: number, message: string, public fields: Record<string, string> = {}) {
    super(message);
  }
}

/** Every admin request carries the CSRF header; failures always surface as ApiError with a readable message. */
export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const headers: Record<string, string> = { "x-alyas-csrf": "1" };
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  let res: Response;
  try {
    res = await fetch(path, { method: opts.method ?? (body ? "POST" : "GET"), headers, body, cache: "no-store", credentials: "same-origin" });
  } catch {
    throw new ApiError(0, "Could not reach the server. Check your connection and try again.");
  }
  const json = await res.json().catch(() => ({}));
  if (res.status === 401 && !path.startsWith("/api/auth/")) {
    window.location.href = "/admin/login";
    throw new ApiError(401, "Your session has ended. Please sign in again.");
  }
  if (!res.ok) throw new ApiError(res.status, json.error || "Something went wrong. Please try again.", json.fields || {});
  return json as T;
}
