import { getMediaBytes } from "@/lib/media";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const w = Math.min(2400, Math.max(64, Number(new URL(req.url).searchParams.get("w")) || 1600));
  const file = await getMediaBytes(id, w);
  if (!file) return new Response("Not found", { status: 404 });
  const etag = `"${id}-${file.width}"`;
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers: { ETag: etag } });
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: etag,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
