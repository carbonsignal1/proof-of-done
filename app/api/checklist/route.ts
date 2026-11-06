import { NextResponse } from "next/server";
import { draftChecklist } from "@/lib/ai";
import { errorResponse } from "@/lib/http";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { title, description } = (await req.json().catch(() => ({}))) as { title?: string; description?: string };
    const t = String(title ?? "").trim().slice(0, 80);
    const d = String(description ?? "").trim().slice(0, 600);
    if (!t && !d) return NextResponse.json({ error: "Describe the job first." }, { status: 400 });
    return NextResponse.json(await draftChecklist(t, d));
  } catch (e) {
    return errorResponse(e);
  }
}
