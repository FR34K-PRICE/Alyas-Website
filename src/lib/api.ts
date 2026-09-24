import { NextResponse } from "next/server";
import { z } from "zod";
import { HttpError, assertSameOrigin } from "./security";

type Ctx = { params: Promise<Record<string, string>> };
type Handler = (req: Request, ctx: Ctx) => Promise<Response | object>;

/** Wraps a route handler: CSRF check for mutations, uniform JSON errors, no stack leaks. */
export function route(handler: Handler) {
  return async (req: Request, ctx: Ctx) => {
    try {
      assertSameOrigin(req);
      const out = await handler(req, ctx);
      if (out instanceof Response) return out;
      return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
    } catch (e) {
      if (e instanceof HttpError) {
        const headers: Record<string, string> = { "Cache-Control": "no-store" };
        if (e.status === 429 && typeof e.extra?.retryAfter === "number") headers["Retry-After"] = String(e.extra.retryAfter);
        return NextResponse.json({ error: e.message, ...e.extra }, { status: e.status, headers });
      }
      if (e instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Please check the highlighted fields.", fields: fieldErrors(e) },
          { status: 400, headers: { "Cache-Control": "no-store" } },
        );
      }
      console.error("[api]", e);
      return NextResponse.json({ error: "Something went wrong on our side. Please try again." }, { status: 500 });
    }
  };
}

export function fieldErrors(e: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of e.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export async function readJson<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > 1_000_000) throw new HttpError(413, "Request too large.");
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new HttpError(400, "Invalid JSON.");
  }
  return schema.parse(body);
}
