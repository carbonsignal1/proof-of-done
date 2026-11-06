// Job lifecycle. Every money movement happens here, after the rules in
// lib/rules.ts have decided.
import { decide, isExpired } from "./rules";
import { addEvent, load, newId, withDB, type DB } from "./store";
import { captureHold, defaultPayoutReceiver, payWorker, PayPalError, voidHold } from "./paypal";
import type { ChecklistItem, Job, Verdict } from "./types";

const usd = (n: number) => `$${n.toFixed(2)}`;

export class JobError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

function find(db: DB, id: string): Job {
  const job = db.jobs.find((j) => j.id === id);
  if (!job) throw new JobError("Job not found", 404);
  return job;
}

export async function createJob(input: {
  title: string;
  description: string;
  price: number;
  posterName: string;
  deadlineMinutes: number;
  checklist: ChecklistItem[];
}): Promise<Job> {
  const job: Job = {
    id: newId("job"),
    title: input.title,
    description: input.description,
    price: input.price,
    posterName: input.posterName,
    deadline: new Date(Date.now() + input.deadlineMinutes * 60_000).toISOString(),
    checklist: input.checklist,
    status: "awaiting_hold",
    attempts: [],
    paypal: { mock: false },
    events: [],
    createdAt: new Date().toISOString(),
  };
  addEvent(job, "created", `${input.posterName} posted the job for ${usd(input.price)} with ${input.checklist.length} checklist items.`);
  await withDB((db) => {
    db.jobs.unshift(job);
  });
  return job;
}

export function getJob(db: DB, id: string) {
  return find(db, id);
}

export async function recordHold(id: string, hold: { orderId: string; authorizationId: string; expires?: string; amount: number; mock: boolean }) {
  return withDB((db) => {
    const job = find(db, id);
    if (job.status !== "awaiting_hold") throw new JobError("This job already has a payment hold.");
    if (Math.abs(hold.amount - job.price) > 0.001) throw new JobError(`Held ${usd(hold.amount)} but the job costs ${usd(job.price)}.`);
    job.paypal = { mock: hold.mock, orderId: hold.orderId, authorizationId: hold.authorizationId, authorizationExpires: hold.expires };
    job.status = "open";
    addEvent(job, "hold", `PayPal is holding ${usd(job.price)}${hold.mock ? " (mock)" : ""}. Nothing is charged until the work is verified.`, hold.authorizationId);
    return job;
  });
}

export async function claimJob(id: string, worker: { name: string; paypalEmail?: string }, beforePhoto: string) {
  return withDB((db) => {
    const job = find(db, id);
    if (job.status !== "open") throw new JobError("This job isn't open for claiming.");
    job.worker = worker;
    job.beforePhoto = beforePhoto;
    job.status = "claimed";
    addEvent(job, "claim", `${worker.name} claimed the job and took the "before" photo.`);
    return job;
  });
}

/** Capture the hold and pay the worker. Caller holds the DB lock. */
async function release(job: Job, why: string) {
  if (!job.paypal.authorizationId) throw new JobError("No PayPal hold to release.", 500);
  const cap = await captureHold(job.paypal.authorizationId, job.price, job.paypal.mock);
  job.paypal.captureId = cap.captureId;
  job.status = "paid";
  job.closedReason = why;
  addEvent(job, "capture", `PayPal captured ${usd(job.price)} from the hold.`, cap.captureId);

  const receiver = job.worker?.paypalEmail || defaultPayoutReceiver();
  if (!job.paypal.mock && !receiver) {
    job.paypal.payoutStatus = "SKIPPED";
    job.paypal.payoutNote = "No worker PayPal email or PAYPAL_PAYOUT_RECEIVER configured.";
    addEvent(job, "error", "Payout skipped: no worker PayPal email configured.");
    return;
  }
  try {
    const p = await payWorker({
      receiver: receiver ?? "worker@example.com",
      amount: job.price,
      note: `Payment for "${job.title}" (verified by Proof-of-Done)`,
      jobId: job.id,
      mock: job.paypal.mock,
    });
    job.paypal.payoutBatchId = p.batchId;
    job.paypal.payoutStatus = p.status;
    addEvent(job, "payout", `Paid ${usd(job.price)} to ${job.worker?.name ?? "the worker"} with PayPal Payouts${job.paypal.mock ? " (mock)" : ""}.`, p.batchId);
  } catch (e) {
    job.paypal.payoutStatus = "FAILED";
    job.paypal.payoutNote = e instanceof Error ? e.message : String(e);
    addEvent(job, "error", `Payout failed: ${job.paypal.payoutNote}`);
  }
}

/** Void the hold. Caller holds the DB lock. */
async function cancel(job: Job, why: string) {
  if (job.paypal.authorizationId && job.status !== "awaiting_hold") {
    try {
      await voidHold(job.paypal.authorizationId, job.paypal.mock);
      addEvent(job, "void", `PayPal hold released. ${job.posterName} was never charged.`, job.paypal.authorizationId);
    } catch (e) {
      // An expired authorization can't be voided, but it also can't be captured: nobody is charged.
      const msg = e instanceof PayPalError ? e.message : String(e);
      addEvent(job, "error", `Void failed (${msg}). The hold will lapse on its own.`);
    }
  }
  job.status = "cancelled";
  job.closedReason = why;
}

export async function submitProof(id: string, photo: string, getVerdict: (job: Job) => Promise<{ verdict: Verdict; model: string }>) {
  // Grade outside the lock (the AI call takes seconds), then re-check state inside it.
  const snapshot = await withDB((db) => {
    const job = find(db, id);
    if (job.status !== "claimed") throw new JobError("Proof can only be submitted for a claimed job.");
    return structuredClone(job);
  });
  const { verdict, model } = await getVerdict(snapshot);

  return withDB(async (db) => {
    const job = find(db, id);
    if (job.status !== "claimed") throw new JobError("The job changed while the proof was being checked.");
    const attemptNumber = job.attempts.length + 1;
    const rule = decide(job.checklist, verdict, attemptNumber);
    job.attempts.push({ id: newId("att"), photo, verdict, decision: rule.decision, reason: rule.reason, model, createdAt: new Date().toISOString() });
    addEvent(job, "proof", `Proof #${attemptNumber} checked by AI: ${verdict.summary}`);

    if (rule.decision === "approve") {
      addEvent(job, "approve", rule.reason);
      await release(job, "Verified by AI");
    } else if (rule.decision === "reject") {
      addEvent(job, "reject", rule.reason);
    } else {
      job.status = "review";
      addEvent(job, "review", rule.reason);
    }
    return { job, rule };
  });
}

export async function posterDecision(id: string, approve: boolean) {
  return withDB(async (db) => {
    const job = find(db, id);
    if (job.status !== "review") throw new JobError("Nothing is waiting for your decision on this job.");
    if (approve) {
      addEvent(job, "approve", `${job.posterName} approved the work.`);
      await release(job, "Approved by the poster");
    } else {
      addEvent(job, "reject", `${job.posterName} rejected the work.`);
      await cancel(job, "Rejected by the poster");
    }
    return job;
  });
}

export async function cancelJob(id: string) {
  return withDB(async (db) => {
    const job = find(db, id);
    if (job.status === "paid" || job.status === "cancelled") throw new JobError("This job is already closed.");
    addEvent(job, "void", `${job.posterName} cancelled the job.`);
    await cancel(job, "Cancelled by the poster");
    return job;
  });
}

/** Release the hold on every job whose deadline passed before it was paid. */
export async function sweepExpired() {
  const due = (j: Job) => ["awaiting_hold", "open", "claimed", "review"].includes(j.status) && isExpired(j.deadline);
  // Cheap check without the lock first.
  if (!load().jobs.some(due)) return;
  await withDB(async (db) => {
    for (const job of db.jobs.filter(due)) {
      addEvent(job, "void", "The deadline passed before the work was verified.");
      await cancel(job, "Deadline passed");
    }
  });
}
