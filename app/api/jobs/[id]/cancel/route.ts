import { NextResponse } from "next/server";
import { cancelJob } from "@/lib/jobs";
import { errorResponse } from "@/lib/http";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    return NextResponse.json({ job: await cancelJob(id) });
  } catch (e) {
    return errorResponse(e);
  }
}
