// Payment hold for a job.
//   POST { action: "create" }               -> PayPal order with intent AUTHORIZE (for the JS SDK popup)
//   POST { action: "authorize", orderID }   -> authorize the approved order, job becomes "open"
//   POST { action: "mock" }                 -> simulated hold (only without PayPal credentials)
import { NextResponse } from "next/server";
import { authorizeOrder, createHoldOrder, mockHold, paypalMode } from "@/lib/paypal";
import { getJob, JobError, recordHold } from "@/lib/jobs";
import { load } from "@/lib/store";
import { errorResponse } from "@/lib/http";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as { action?: string; orderID?: string };
    const job = getJob(load(), id);
    if (job.status !== "awaiting_hold") throw new JobError("This job already has a payment hold.");
    const mode = paypalMode();

    if (body.action === "mock") {
      if (mode !== "mock") throw new JobError("Use PayPal checkout; mock holds are disabled when PayPal is configured.");
      const h = mockHold();
      return NextResponse.json({ job: await recordHold(id, { ...h, amount: job.price, mock: true }) });
    }
    if (mode !== "sandbox") throw new JobError("PayPal is in mock mode.");

    if (body.action === "create") {
      const order = await createHoldOrder(job.id, job.price, `Proof-of-Done: ${job.title}`);
      return NextResponse.json({ id: order.id });
    }
    if (body.action === "authorize") {
      if (!body.orderID) throw new JobError("orderID is required.");
      const a = await authorizeOrder(body.orderID);
      if (a.referenceId && a.referenceId !== job.id) throw new JobError("That PayPal order belongs to a different job.");
      const updated = await recordHold(id, { orderId: body.orderID, authorizationId: a.authorizationId, expires: a.expires, amount: a.amount, mock: false });
      return NextResponse.json({ job: updated });
    }
    throw new JobError("Unknown action.");
  } catch (e) {
    return errorResponse(e);
  }
}
