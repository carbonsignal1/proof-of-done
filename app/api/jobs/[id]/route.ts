import { NextResponse } from "next/server";
import { getJob, sweepExpired } from "@/lib/jobs";
import { load } from "@/lib/store";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    await sweepExpired();
    return NextResponse.json({ job: getJob(load(), id) });
  } catch (e) {
    return errorResponse(e);
  }
}
