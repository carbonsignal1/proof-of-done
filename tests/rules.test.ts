import { test } from "node:test";
import assert from "node:assert/strict";
import { decide, isExpired, MAX_ATTEMPTS } from "../lib/rules.ts";
import type { ChecklistItem, Verdict } from "../lib/types.ts";

const checklist: ChecklistItem[] = [
  { id: "a", text: "Desk surface clear", required: true },
  { id: "b", text: "Cables tidied", required: true },
  { id: "c", text: "Plant watered", required: false },
];

const verdict = (over: Partial<Verdict> = {}): Verdict => ({
  items: [
    { id: "a", passed: true, evidence: "" },
    { id: "b", passed: true, evidence: "" },
    { id: "c", passed: false, evidence: "" },
  ],
  same_location: true,
  confidence: "high",
  summary: "",
  feedback_for_worker: "",
  ...over,
});

test("approves when every required item passes with high confidence", () => {
  assert.equal(decide(checklist, verdict(), 1).decision, "approve");
});

test("optional items don't block payment", () => {
  assert.equal(decide(checklist, verdict(), 1).decision, "approve");
});

test("rejects when a required item fails", () => {
  const r = decide(checklist, verdict({ items: [{ id: "a", passed: true, evidence: "" }, { id: "b", passed: false, evidence: "" }] }), 1);
  assert.equal(r.decision, "reject");
  assert.match(r.reason, /Cables tidied/);
});

test("a required item the model didn't grade counts as failed", () => {
  const r = decide(checklist, verdict({ items: [{ id: "a", passed: true, evidence: "" }] }), 1);
  assert.equal(r.decision, "reject");
});

test("rejects photos of a different place", () => {
  assert.equal(decide(checklist, verdict({ same_location: false }), 1).decision, "reject");
});

test("sends unsure verdicts to the poster", () => {
  assert.equal(decide(checklist, verdict({ confidence: "medium" }), 1).decision, "review");
  const lowFail = verdict({ confidence: "low", items: [{ id: "a", passed: false, evidence: "" }, { id: "b", passed: true, evidence: "" }] });
  assert.equal(decide(checklist, lowFail, 1).decision, "review");
});

test("after the last attempt the poster decides instead of auto-rejecting", () => {
  const failing = verdict({ items: [{ id: "a", passed: false, evidence: "" }, { id: "b", passed: true, evidence: "" }] });
  assert.equal(decide(checklist, failing, MAX_ATTEMPTS - 1).decision, "reject");
  assert.equal(decide(checklist, failing, MAX_ATTEMPTS).decision, "review");
  assert.equal(decide(checklist, verdict({ same_location: false }), MAX_ATTEMPTS).decision, "review");
});

test("never approves on medium confidence even when everything passes", () => {
  assert.notEqual(decide(checklist, verdict({ confidence: "medium" }), 1).decision, "approve");
});

test("expiry", () => {
  assert.equal(isExpired(new Date(Date.now() - 1000).toISOString()), true);
  assert.equal(isExpired(new Date(Date.now() + 60_000).toISOString()), false);
});
