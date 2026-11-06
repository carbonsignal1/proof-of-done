import { NextResponse } from "next/server";
import { createJob, sweepExpired } from "@/lib/jobs";
import { load, newId } from "@/lib/store";
import { paypalMode, defaultPayoutReceiver } from "@/lib/paypal";
import { aiMode, MODEL } from "@/lib/ai";
import { errorResponse } from "@/lib/http";
import type { ChecklistItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  await sweepExpired();
  return NextResponse.json({
    jobs: load().jobs,
    modes: {
      paypal: paypalMode(),
      ai: aiMode(),
      model: aiMode() === "claude" ? MODEL : "mock",
      payoutReceiverConfigured: Boolean(defaultPayoutReceiver()),
    },
  });
}

export async function POST(req: Request) {
  try {
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const title = String(b.title ?? "").trim().slice(0, 80);
    const description = String(b.description ?? "").trim().slice(0, 600);
    const posterName = String(b.posterName ?? "").trim().slice(0, 40) || "Poster";
    const price = Math.round(Number(b.price) * 100) / 100;
    const deadlineMinutes = Math.round(Number(b.deadlineMinutes));
    const raw = Array.isArray(b.checklist) ? (b.checklist as Partial<ChecklistItem>[]) : [];
    const checklist: ChecklistItem[] = raw
      .map((c) => ({ id: newId("chk"), text: String(c.text ?? "").trim().slice(0, 80), required: c.required !== false }))
      .filter((c) => c.text);

    if (!title) return NextResponse.json({ error: "Give the job a title." }, { status: 400 });
    if (!Number.isFinite(price) || price < 1 || price > 1000) return NextResponse.json({ error: "Price must be between $1 and $1000." }, { status: 400 });
    if (!Number.isFinite(deadlineMinutes) || deadlineMinutes < 1 || deadlineMinutes > 7 * 24 * 60) {
      return NextResponse.json({ error: "Pick a deadline." }, { status: 400 });
    }
    if (!checklist.some((c) => c.required)) return NextResponse.json({ error: "The checklist needs at least one required item." }, { status: 400 });

    const job = await createJob({ title, description, price, posterName, deadlineMinutes, checklist: checklist.slice(0, 8) });
    return NextResponse.json({ job });
  } catch (e) {
    return errorResponse(e);
  }
}
