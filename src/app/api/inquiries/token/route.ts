import { route } from "@/lib/api";
import { issueToken } from "@/lib/inquiries";
import { turnstile } from "@/lib/env";

export const GET = route(async () => ({ token: issueToken(), turnstileSiteKey: turnstile().siteKey }));
