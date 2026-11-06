export interface ChecklistItem {
  id: string;
  text: string;
  required: boolean;
}

/**
 * awaiting_hold  created, PayPal hold not approved yet
 * open           money held by PayPal, waiting for a worker
 * claimed        worker took the job and the "before" photo
 * review         AI was unsure (or retries ran out): the poster decides
 * paid           PayPal captured the hold and paid the worker
 * cancelled      hold voided (cancelled, expired or rejected); payer never charged
 */
export type JobStatus = "awaiting_hold" | "open" | "claimed" | "review" | "paid" | "cancelled";

export type Confidence = "high" | "medium" | "low";

/** What the AI says about one proof photo. */
export interface Verdict {
  items: { id: string; passed: boolean; evidence: string }[];
  same_location: boolean;
  confidence: Confidence;
  summary: string;
  feedback_for_worker: string;
}

export type Decision = "approve" | "reject" | "review";

export interface Attempt {
  id: string;
  photo: string;
  verdict: Verdict;
  decision: Decision;
  reason: string;
  model: string;
  createdAt: string;
}

export type EventKind = "created" | "hold" | "claim" | "proof" | "approve" | "reject" | "review" | "capture" | "payout" | "void" | "error";

export interface JobEvent {
  ts: string;
  kind: EventKind;
  message: string;
  ref?: string;
}

export interface Job {
  id: string;
  title: string;
  description: string;
  price: number;
  posterName: string;
  deadline: string;
  checklist: ChecklistItem[];
  status: JobStatus;
  worker?: { name: string; paypalEmail?: string };
  beforePhoto?: string;
  attempts: Attempt[];
  paypal: {
    mock: boolean;
    orderId?: string;
    authorizationId?: string;
    authorizationExpires?: string;
    captureId?: string;
    payoutBatchId?: string;
    payoutStatus?: string;
    payoutNote?: string;
  };
  closedReason?: string;
  events: JobEvent[];
  createdAt: string;
}
