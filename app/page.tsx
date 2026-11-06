"use client";
import Link from "next/link";
import { StatusPill, timeAgo, timeLeft, usd, useJobs, useRole } from "@/components/state";

export default function Board() {
  const { data, refresh } = useJobs();
  const { role } = useRole();

  async function resetDemo() {
    if (!confirm("Erase all local jobs and photos? (PayPal Sandbox is not touched.)")) return;
    await fetch("/api/reset", { method: "POST" });
    refresh();
  }

  const jobs = data?.jobs ?? [];
  const active = jobs.filter((j) => !["paid", "cancelled"].includes(j.status));
  const closed = jobs.filter((j) => ["paid", "cancelled"].includes(j.status));
  const held = jobs.filter((j) => ["open", "claimed", "review"].includes(j.status)).reduce((s, j) => s + j.price, 0);

  return (
    <main className="page">
      <div className="job-head" style={{ marginBottom: 18 }}>
        <div>
          <h1>Pay when it&apos;s done.</h1>
          <p className="lede" style={{ marginBottom: 0 }}>
            Post a small job and PayPal holds the money. The worker sends photo proof, AI checks it against the checklist you agreed on, and the payment is released only when the work is done.
          </p>
        </div>
        {role === "poster" && (
          <Link href="/new" className="btn primary lg">Post a job</Link>
        )}
      </div>

      {data && jobs.length > 0 && (
        <div className="stats" style={{ marginBottom: 18 }}>
          <div className="card stat"><div className="k">Held by PayPal now</div><div className="v">{usd(held)}</div></div>
          <div className="card stat"><div className="k">Active jobs</div><div className="v">{active.length}</div></div>
          <div className="card stat"><div className="k">Paid after proof</div><div className="v">{jobs.filter((j) => j.status === "paid").length}</div></div>
          <div className="card stat"><div className="k">Holds released</div><div className="v">{jobs.filter((j) => j.status === "cancelled").length}</div></div>
        </div>
      )}

      {!data && <div className="card muted">Loading…</div>}
      {data && jobs.length === 0 && (
        <div className="card" style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 36 }}>🧹</div>
          <h2 style={{ marginTop: 8 }}>No jobs yet</h2>
          <p className="muted">Post the first one: tidy a desk, mow a lawn, assemble a shelf.</p>
          <Link href="/new" className="btn primary">Post a job</Link>
        </div>
      )}

      {active.length > 0 && (
        <>
          <h2 style={{ marginTop: 6 }}>Active</h2>
          <div className="board" style={{ marginBottom: 24 }}>
            {active.map((j) => (
              <Link key={j.id} href={`/jobs/${j.id}`} className="card job-card">
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <StatusPill status={j.status} />
                  <span className="small muted">{timeLeft(j.deadline)}</span>
                </div>
                <div className="t">{j.title}</div>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="small muted">
                    {j.worker ? `${j.worker.name} is on it` : `Posted by ${j.posterName}`} · {j.checklist.length} checks
                  </span>
                  <span className="p">{usd(j.price)}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      {closed.length > 0 && (
        <>
          <h2>Closed</h2>
          <div className="board">
            {closed.map((j) => (
              <Link key={j.id} href={`/jobs/${j.id}`} className="card job-card" style={{ opacity: 0.85 }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <StatusPill status={j.status} />
                  <span className="small muted">{timeAgo(j.createdAt)}</span>
                </div>
                <div className="t">{j.title}</div>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="small muted">{j.closedReason}</span>
                  <span className="p">{usd(j.price)}</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}

      <p className="footer-note">
        AI judges the work. Code decides the money. PayPal holds and releases it.
        {jobs.length > 0 && (
          <>
            {" · "}
            <button className="btn sm" onClick={resetDemo} style={{ marginLeft: 6 }}>Reset demo data</button>
          </>
        )}
      </p>
    </main>
  );
}
