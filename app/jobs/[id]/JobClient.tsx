"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { StatusPill, timeAgo, timeLeft, usd, useJobs, useRole } from "@/components/state";
import { PhotoInput } from "@/components/PhotoInput";
import { PayPalHoldButton } from "@/components/PayPalHoldButton";
import type { Attempt, Job } from "@/lib/types";

const EVENT_ICON: Record<string, string> = {
  created: "📝", hold: "🔒", claim: "🙋", proof: "📷", approve: "✅", reject: "↩️", review: "🤔", capture: "💳", payout: "💸", void: "🔓", error: "⚠️",
};

const MOCK_OUTCOMES = [
  { value: "done", label: "Everything done" },
  { value: "partial", label: "Partly done" },
  { value: "elsewhere", label: "Photo of a different place" },
  { value: "unsure", label: "Unclear photo" },
];

export function JobClient({ id, clientId }: { id: string; clientId: string | null }) {
  const { role } = useRole();
  const { data: list } = useJobs(5000);
  const modes = list?.modes;
  const [job, setJob] = useState<Job | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: string; text: string } | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/jobs/${id}`, { cache: "no-store" });
    if (res.status === 404) return setMissing(true);
    if (res.ok) setJob((await res.json()).job);
  }, [id]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 2000);
    return () => clearInterval(t);
  }, [refresh]);

  async function act(label: string, fn: () => Promise<Response>, ok?: (json: Record<string, unknown>) => string) {
    setBusy(label);
    setNote(null);
    try {
      const res = await fn();
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Something went wrong");
      if (json.job) setJob(json.job as Job);
      if (ok) setNote({ tone: "ok", text: ok(json) });
    } catch (e) {
      setNote({ tone: "block", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
      refresh();
    }
  }

  if (missing) return <main className="page page-narrow"><div className="card">Job not found. <Link href="/">Back to jobs</Link></div></main>;
  if (!job) return <main className="page muted">Loading…</main>;

  const last: Attempt | undefined = job.attempts[job.attempts.length - 1];
  const graded = last ? new Map(last.verdict.items.map((i) => [i.id, i])) : null;
  const closed = job.status === "paid" || job.status === "cancelled";

  return (
    <main className="page">
      <div className="small" style={{ marginBottom: 10 }}><Link href="/">← All jobs</Link></div>
      {note && <div className={`notice ${note.tone}`} style={{ marginBottom: 14 }}>{note.text}</div>}

      <div className="layout">
        <div className="stack">
          {/* ---------- header ---------- */}
          <section className="card stack">
            <div className="job-head">
              <div style={{ minWidth: 0 }}>
                <div className="row" style={{ marginBottom: 6 }}>
                  <StatusPill status={job.status} />
                  {!closed && <span className="small muted">{timeLeft(job.deadline)}</span>}
                </div>
                <h1 style={{ marginBottom: 4 }}>{job.title}</h1>
                <div className="small muted">
                  Posted by {job.posterName} · {timeAgo(job.createdAt)}
                  {job.worker && <> · worker: {job.worker.name}</>}
                </div>
              </div>
              <div className="job-price">{usd(job.price)}</div>
            </div>
            {job.description && <p style={{ margin: 0 }}>{job.description}</p>}
          </section>

          {/* ---------- what happens next ---------- */}
          <ActionPanel
            job={job}
            role={role}
            clientId={clientId}
            aiMock={modes?.ai === "mock"}
            busy={busy}
            last={last}
            onHeld={() => {
              setNote({ tone: "ok", text: "PayPal is now holding the payment. Nothing is charged until the work is verified." });
              refresh();
            }}
            onError={(t) => setNote({ tone: "block", text: t })}
            act={act}
          />

          {/* ---------- checklist ---------- */}
          <section className="card">
            <h2>What &quot;done&quot; means</h2>
            {job.checklist.map((c) => {
              const g = graded?.get(c.id);
              return (
                <div key={c.id} className="check">
                  <span className={`mark ${g ? (g.passed ? "pass" : "fail") : ""}`}>{g ? (g.passed ? "✓" : "✕") : "•"}</span>
                  <div>
                    <div>{c.text}</div>
                    {g && <div className="ev">{g.evidence}</div>}
                  </div>
                  <span className="pill">{c.required ? "required" : "optional"}</span>
                </div>
              );
            })}
          </section>

          {/* ---------- photos ---------- */}
          {(job.beforePhoto || job.attempts.length > 0) && (
            <section className="card">
              <h2>Photos</h2>
              <div className="photos">
                {job.beforePhoto && (
                  <div className="photo">
                    <img src={`/api/photos/${job.beforePhoto}`} alt="Before" />
                    <div className="cap">Before</div>
                  </div>
                )}
                {job.attempts.map((a, i) => (
                  <div className="photo" key={a.id}>
                    <img src={`/api/photos/${a.photo}`} alt={`Proof ${i + 1}`} />
                    <div className="cap">
                      Proof #{i + 1}
                      <span className={`pill ${a.decision === "approve" ? "ok" : a.decision === "reject" ? "block" : "warn"}`}>
                        {a.decision === "approve" ? "approved" : a.decision === "reject" ? "rejected" : "to poster"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* ---------- sidebar ---------- */}
        <aside className="stack">
          <section className="card">
            <h2>Payment</h2>
            <div className="held" style={{ marginBottom: 6 }}>{usd(job.price)}</div>
            <div className="small muted" style={{ marginBottom: 10 }}>
              {job.status === "awaiting_hold" && "Not held yet."}
              {["open", "claimed", "review"].includes(job.status) && "Held by PayPal. Not charged yet."}
              {job.status === "paid" && "Captured and paid to the worker."}
              {job.status === "cancelled" && (job.paypal.authorizationId ? "Hold released. The poster was never charged." : "No payment was held.")}
            </div>
            <Row k="Mode" v={job.paypal.mock ? "Mock PayPal" : "PayPal Sandbox"} />
            {job.paypal.orderId && <Row k="Order" v={job.paypal.orderId} mono />}
            {job.paypal.authorizationId && <Row k="Hold (authorization)" v={job.paypal.authorizationId} mono />}
            {job.paypal.authorizationExpires && !closed && <Row k="Hold valid until" v={new Date(job.paypal.authorizationExpires).toLocaleDateString()} />}
            {job.paypal.captureId && <Row k="Capture" v={job.paypal.captureId} mono />}
            {job.paypal.payoutBatchId && <Row k="Payout to worker" v={job.paypal.payoutBatchId} mono />}
            {job.paypal.payoutStatus && job.paypal.payoutStatus !== "SUCCESS" && <Row k="Payout status" v={`${job.paypal.payoutStatus}${job.paypal.payoutNote ? `: ${job.paypal.payoutNote}` : ""}`} />}
          </section>

          <section className="card">
            <h2>Timeline</h2>
            <div className="timeline">
              {[...job.events].reverse().map((e, i) => (
                <div className="tl" key={i}>
                  <span>{EVENT_ICON[e.kind] ?? "•"}</span>
                  <div>
                    <div className="small">{e.message}</div>
                    <div className="when">{timeAgo(e.ts)}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="money-row">
      <span className="k">{k}</span>
      <span className={`v ${mono ? "mono" : ""}`}>{v}</span>
    </div>
  );
}

function VerdictCard({ a }: { a: Attempt }) {
  const title = a.decision === "approve" ? "Approved: payment released" : a.decision === "reject" ? "Not done yet" : "Sent to the poster";
  return (
    <div className={`verdict ${a.decision}`}>
      <div className="h">{title}</div>
      <div className="small">{a.reason}</div>
      <div className="small muted">AI: {a.verdict.summary} ({a.verdict.confidence} confidence{a.model !== "mock" ? `, ${a.model}` : ", mock"})</div>
      {a.decision === "reject" && a.verdict.feedback_for_worker && <div className="quote">{a.verdict.feedback_for_worker}</div>}
    </div>
  );
}

function ActionPanel(props: {
  job: Job;
  role: "poster" | "worker";
  clientId: string | null;
  aiMock: boolean;
  busy: string | null;
  last?: Attempt;
  onHeld: () => void;
  onError: (t: string) => void;
  act: (label: string, fn: () => Promise<Response>, ok?: (json: Record<string, unknown>) => string) => Promise<void>;
}) {
  const { job, role, clientId, aiMock, busy, last, act } = props;
  const [name, setName] = useState("Sam");
  const [email, setEmail] = useState("");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [mockOutcome, setMockOutcome] = useState("partial");
  const [photoKey, setPhotoKey] = useState(0);

  const post = (path: string, body?: unknown) =>
    fetch(`/api/jobs/${job.id}/${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const cancelBtn = (
    <button
      className="btn danger"
      disabled={!!busy}
      onClick={() => confirm("Cancel the job and release the PayPal hold?") && act("cancel", () => post("cancel"), () => "Job cancelled. The PayPal hold was released.")}
    >
      Cancel & release hold
    </button>
  );

  // ----- awaiting hold -----
  if (job.status === "awaiting_hold") {
    if (role === "worker") return <section className="card muted">Waiting for {job.posterName} to fund this job.</section>;
    return (
      <section className="card stack">
        <h2 style={{ margin: 0 }}>Hold the payment with PayPal</h2>
        <p className="small muted" style={{ margin: 0 }}>
          You approve {usd(job.price)} now, but PayPal only <strong>holds</strong> it. You&apos;re charged when the AI verifies the work, and the hold is released if it isn&apos;t done in time.
        </p>
        {clientId ? (
          <PayPalHoldButton clientId={clientId} jobId={job.id} onHeld={props.onHeld} onError={props.onError} />
        ) : (
          <>
            <button className="btn primary lg" disabled={!!busy} onClick={() => act("hold", () => post("hold", { action: "mock" }), () => "Mock PayPal hold placed.")}>
              Hold {usd(job.price)} (mock PayPal)
            </button>
            <div className="notice warn small">Mock mode: add PayPal Sandbox keys to use real PayPal checkout.</div>
          </>
        )}
      </section>
    );
  }

  // ----- open -----
  if (job.status === "open") {
    if (role === "poster")
      return (
        <section className="card stack">
          <div className="notice info">PayPal is holding {usd(job.price)}. Waiting for someone to claim the job.</div>
          <div>{cancelBtn}</div>
        </section>
      );
    return (
      <section className="card stack">
        <h2 style={{ margin: 0 }}>Take this job</h2>
        <p className="small muted" style={{ margin: 0 }}>The money is already held by PayPal. Take a &quot;before&quot; photo of the spot so the AI can compare later.</p>
        <div className="grid2">
          <label className="field">Your name<input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} /></label>
          <label className="field">PayPal email for payout (optional)<input type="text" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Sandbox account email" /></label>
        </div>
        <PhotoInput key={`b${photoKey}`} label="Take the BEFORE photo" onChange={setPhoto} />
        <button
          className="btn primary lg"
          disabled={!photo || !name.trim() || !!busy}
          onClick={() =>
            act(
              "claim",
              () => {
                const fd = new FormData();
                fd.set("name", name);
                if (email) fd.set("paypalEmail", email);
                fd.set("photo", photo!, "before.jpg");
                return fetch(`/api/jobs/${job.id}/claim`, { method: "POST", body: fd });
              },
              () => {
                setPhoto(null);
                setPhotoKey((k) => k + 1);
                return "You've claimed the job. Do the work, then send the proof photo.";
              },
            )
          }
        >
          {busy === "claim" ? "Claiming…" : "Claim job"}
        </button>
      </section>
    );
  }

  // ----- claimed -----
  if (job.status === "claimed") {
    if (role === "poster")
      return (
        <section className="card stack">
          <div className="notice info">{job.worker?.name} is working on it. {usd(job.price)} stays held until the proof is verified.</div>
          {last && <VerdictCard a={last} />}
          <div>{cancelBtn}</div>
        </section>
      );
    return (
      <section className="card stack">
        <h2 style={{ margin: 0 }}>{last ? "Try again" : "Send your proof"}</h2>
        {last && <VerdictCard a={last} />}
        <p className="small muted" style={{ margin: 0 }}>
          Take the AFTER photo from the same spot as the before photo, showing every checklist item. Attempt {job.attempts.length + 1} of 3.
        </p>
        <PhotoInput key={`a${photoKey}`} label="Take the AFTER photo" onChange={setPhoto} />
        {aiMock && (
          <label className="field">
            Mock AI result (no Anthropic key set)
            <select className="select" value={mockOutcome} onChange={(e) => setMockOutcome(e.target.value)}>
              {MOCK_OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        )}
        <button
          className="btn primary lg"
          disabled={!photo || !!busy}
          onClick={() =>
            act(
              "proof",
              () => {
                const fd = new FormData();
                fd.set("photo", photo!, "after.jpg");
                if (aiMock) fd.set("mockOutcome", mockOutcome);
                return fetch(`/api/jobs/${job.id}/proof`, { method: "POST", body: fd });
              },
              (json) => {
                setPhoto(null);
                setPhotoKey((k) => k + 1);
                const d = (json.rule as { decision: string })?.decision;
                return d === "approve" ? `Verified! PayPal released ${usd(job.price)} to you.` : d === "reject" ? "Not quite done. See what to fix below." : "The poster will make the final call.";
              },
            )
          }
        >
          {busy === "proof" ? <><span className="spinner" /> AI is checking the photo…</> : "Submit proof"}
        </button>
      </section>
    );
  }

  // ----- review -----
  if (job.status === "review") {
    if (role === "worker")
      return (
        <section className="card stack">
          {last && <VerdictCard a={last} />}
          <div className="notice info">Waiting for {job.posterName} to make the final call.</div>
        </section>
      );
    return (
      <section className="card stack">
        <h2 style={{ margin: 0 }}>Your call</h2>
        {last && <VerdictCard a={last} />}
        {last && (
          <div className="photos">
            {job.beforePhoto && <div className="photo"><img src={`/api/photos/${job.beforePhoto}`} alt="Before" /><div className="cap">Before</div></div>}
            <div className="photo"><img src={`/api/photos/${last.photo}`} alt="Latest proof" /><div className="cap">Latest proof</div></div>
          </div>
        )}
        <div className="actions">
          <button className="btn danger lg" disabled={!!busy} onClick={() => act("deny", () => post("decision", { approve: false }), () => "Rejected. The PayPal hold was released.")}>
            Reject & release
          </button>
          <button className="btn ok lg" disabled={!!busy} onClick={() => act("approve", () => post("decision", { approve: true }), () => `Approved. ${usd(job.price)} paid to ${job.worker?.name}.`)}>
            {busy === "approve" ? "Paying…" : `Approve & pay ${usd(job.price)}`}
          </button>
        </div>
      </section>
    );
  }

  // ----- closed -----
  return (
    <section className="card stack">
      {job.status === "paid" ? (
        <div className="verdict approve">
          <div className="h">✓ Done and paid</div>
          <div className="small">{job.closedReason}. {usd(job.price)} was captured from the hold and paid to {job.worker?.name}.</div>
        </div>
      ) : (
        <div className="verdict review">
          <div className="h">Hold released</div>
          <div className="small">{job.closedReason}. {job.posterName} was not charged.</div>
        </div>
      )}
      {last && job.status === "paid" && <VerdictCard a={last} />}
    </section>
  );
}
