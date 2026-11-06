// The decision rules. The AI describes what it sees; this code decides what
// happens to the money. Nothing the model writes can release a payment unless
// every rule below is satisfied.
import type { ChecklistItem, Decision, Verdict } from "./types";

/** Total proof attempts a worker gets before the poster has to decide. */
export const MAX_ATTEMPTS = 3;

export interface RuleResult {
  decision: Decision;
  reason: string;
}

export function decide(checklist: ChecklistItem[], verdict: Verdict, attemptNumber: number): RuleResult {
  const byId = new Map(verdict.items.map((i) => [i.id, i]));
  // An item the model forgot to grade counts as not done.
  const failedRequired = checklist.filter((c) => c.required && byId.get(c.id)?.passed !== true);
  const outOfAttempts = attemptNumber >= MAX_ATTEMPTS;

  if (!verdict.same_location) {
    if (outOfAttempts) return { decision: "review", reason: "The photo doesn't appear to show the same place, and the worker is out of retries. The poster decides." };
    return { decision: "reject", reason: "The proof photo doesn't appear to show the same place as the before photo." };
  }

  if (failedRequired.length > 0) {
    const list = failedRequired.map((c) => c.text).join("; ");
    if (outOfAttempts) return { decision: "review", reason: `Still not done after ${MAX_ATTEMPTS} attempts (${list}). The poster decides.` };
    // A low-confidence failure goes to the poster instead of bouncing the worker.
    if (verdict.confidence === "low") return { decision: "review", reason: `The AI isn't sure about: ${list}. The poster decides.` };
    return { decision: "reject", reason: `Not done yet: ${list}.` };
  }

  if (verdict.confidence !== "high") {
    return { decision: "review", reason: `Every required item looks done, but the AI's confidence is ${verdict.confidence}. The poster decides.` };
  }

  return { decision: "approve", reason: "Every required checklist item is visibly done in the same place." };
}

export function isExpired(deadline: string, now = Date.now()): boolean {
  return new Date(deadline).getTime() <= now;
}
