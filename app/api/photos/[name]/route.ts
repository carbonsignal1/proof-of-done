import { readPhoto } from "@/lib/store";

export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const photo = readPhoto(name);
  if (!photo) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(photo.bytes), {
    headers: { "Content-Type": photo.mime, "Cache-Control": "private, max-age=3600" },
  });
}
