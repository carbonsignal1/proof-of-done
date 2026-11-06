import { NextResponse } from "next/server";
import { claimJob, getJob, JobError } from "@/lib/jobs";
import { load } from "@/lib/store";
import { errorResponse, photoFromForm } from "@/lib/http";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    if (getJob(load(), id).status !== "open") throw new JobError("This job isn't open for claiming.");
    const form = await req.formData();
    const name = String(form.get("name") ?? "").trim().slice(0, 40);
    const email = String(form.get("paypalEmail") ?? "").trim().slice(0, 120);
    if (!name) throw new JobError("Enter your name.");
    if (email && !EMAIL.test(email)) throw new JobError("That PayPal email doesn't look right.");
    const photo = await photoFromForm(form);
    return NextResponse.json({ job: await claimJob(id, { name, paypalEmail: email || undefined }, photo) });
  } catch (e) {
    return errorResponse(e);
  }
}
