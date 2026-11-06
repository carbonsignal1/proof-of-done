import { NextResponse } from "next/server";
import { JobError, posterDecision } from "@/lib/jobs";
import { errorResponse } from "@/lib/http";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const { approve } = (await req.json().catch(() => ({}))) as { approve?: boolean };
    if (typeof approve !== "boolean") throw new JobError("approve must be true or false.");
    return NextResponse.json({ job: await posterDecision(id, approve) });
  } catch (e) {
    return errorResponse(e);
  }
}
