import { NextResponse } from "next/server";
import { getJob, JobError, submitProof } from "@/lib/jobs";
import { verifyProof, type MockOutcome } from "@/lib/ai";
import { load } from "@/lib/store";
import { errorResponse, photoFromForm } from "@/lib/http";

export const maxDuration = 120;

const OUTCOMES: MockOutcome[] = ["done", "partial", "elsewhere", "unsure"];

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (getJob(load(), id).status !== "claimed") throw new JobError("Proof can only be submitted for a claimed job.");
    const form = await req.formData();
    const photo = await photoFromForm(form);
    const m = String(form.get("mockOutcome") ?? "");
    const mockOutcome = OUTCOMES.includes(m as MockOutcome) ? (m as MockOutcome) : undefined;
    const result = await submitProof(id, photo, (job) => verifyProof(job, photo, mockOutcome));
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
