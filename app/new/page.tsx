"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { usd } from "@/components/state";

type Item = { key: number; text: string; required: boolean };

const DEADLINES = [
  { label: "2 minutes (demo)", minutes: 2 },
  { label: "1 hour", minutes: 60 },
  { label: "24 hours", minutes: 24 * 60 },
  { label: "48 hours", minutes: 48 * 60 },
  { label: "72 hours", minutes: 72 * 60 },
];

const EXAMPLES = [
  { title: "Tidy and clear my desk", description: "Clear the clutter off my home-office desk, put the papers in the tray, tidy the cables and take any cups to the kitchen.", price: 30 },
  { title: "Mow the front lawn", description: "Mow the small front lawn, clear the clippings off the path and trim the edges along the path.", price: 40 },
  { title: "Clean up the kitchen", description: "Wash the dishes in the sink, wipe the counters and sweep the floor.", price: 35 },
];

let keySeq = 1;

export default function NewJob() {
  const router = useRouter();
  const [posterName, setPosterName] = useState("Alex");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState(30);
  const [deadline, setDeadline] = useState(24 * 60);
  const [items, setItems] = useState<Item[]>([]);
  const [source, setSource] = useState<string>("");
  const [drafting, setDrafting] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function draft() {
    setError(null);
    setDrafting(true);
    try {
      const res = await fetch("/api/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setItems(json.items.map((i: { text: string; required: boolean }) => ({ key: keySeq++, text: i.text, required: i.required })));
      setSource(json.source);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setDrafting(false);
    }
  }

  async function post() {
    setError(null);
    setPosting(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, price, posterName, deadlineMinutes: deadline, checklist: items }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      router.push(`/jobs/${json.job.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPosting(false);
    }
  }

  const update = (key: number, patch: Partial<Item>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const canDraft = (title.trim() || description.trim()) && !drafting;
  const canPost = title.trim() && items.some((i) => i.required && i.text.trim()) && price >= 1 && !posting;

  return (
    <main className="page page-narrow">
      <h1>Post a job</h1>
      <p className="lede">Describe the job, agree on what &quot;done&quot; looks like, then let PayPal hold the payment until it is.</p>
      {error && <div className="notice block" style={{ marginBottom: 14 }}>{error}</div>}

      <div className="stack">
        <section className="card stack">
          <div className="steps-h"><span className="num">1</span><h2 style={{ margin: 0 }}>Describe it</h2></div>
          <div className="row small muted">
            Try:
            {EXAMPLES.map((e) => (
              <button key={e.title} className="suggestion" onClick={() => { setTitle(e.title); setDescription(e.description); setPrice(e.price); setItems([]); }}>
                {e.title}
              </button>
            ))}
          </div>
          <label className="field">
            Job title
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Tidy and clear my desk" maxLength={80} />
          </label>
          <label className="field">
            Details
            <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What needs doing, and where?" maxLength={600} />
          </label>
          <div className="grid2">
            <label className="field">
              Price
              <span className="money"><input type="number" min={1} max={1000} value={price} onChange={(e) => setPrice(Math.max(0, Number(e.target.value)))} /></span>
            </label>
            <label className="field">
              Deadline
              <select className="select" value={deadline} onChange={(e) => setDeadline(Number(e.target.value))}>
                {DEADLINES.map((d) => <option key={d.minutes} value={d.minutes}>{d.label}</option>)}
              </select>
            </label>
            <label className="field">
              Your name
              <input type="text" value={posterName} onChange={(e) => setPosterName(e.target.value)} maxLength={40} />
            </label>
          </div>
        </section>

        <section className="card stack">
          <div className="steps-h">
            <span className="num">2</span>
            <h2 style={{ margin: 0 }}>Agree what &quot;done&quot; means</h2>
          </div>
          <p className="muted small" style={{ margin: 0 }}>
            AI turns your description into checks a photo can prove. Edit them: this is what the worker sees and what the AI checks before any money moves.
          </p>
          <div>
            <button className="btn" onClick={draft} disabled={!canDraft}>
              {drafting ? <><span className="spinner" /> Drafting…</> : items.length ? "Redraft with AI" : "Draft checklist with AI"}
            </button>
            {source && <span className="small muted" style={{ marginLeft: 10 }}>{source === "template" ? "from a template (AI in mock mode)" : `by ${source}`}</span>}
          </div>
          {items.length > 0 && (
            <div className="stack" style={{ gap: 8 }}>
              {items.map((i) => (
                <div key={i.key} className="check-edit">
                  <input type="text" value={i.text} onChange={(e) => update(i.key, { text: e.target.value })} aria-label="Checklist item" maxLength={80} />
                  <label className="req">
                    <input type="checkbox" checked={i.required} onChange={(e) => update(i.key, { required: e.target.checked })} />
                    Required
                  </label>
                  <button className="btn sm" onClick={() => setItems((xs) => xs.filter((x) => x.key !== i.key))} aria-label="Remove item">✕</button>
                </div>
              ))}
              <div>
                <button className="btn sm" onClick={() => setItems((xs) => [...xs, { key: keySeq++, text: "", required: true }])}>+ Add item</button>
              </div>
            </div>
          )}
        </section>

        <section className="card stack">
          <div className="steps-h"><span className="num">3</span><h2 style={{ margin: 0 }}>Post and hold the payment</h2></div>
          <p className="muted small" style={{ margin: 0 }}>
            Next you approve a PayPal payment of {usd(price || 0)}. PayPal only <strong>holds</strong> it: you&apos;re charged when the work is verified, and the hold is released if it isn&apos;t done by the deadline.
          </p>
          <button className="btn primary lg" onClick={post} disabled={!canPost}>
            {posting ? "Posting…" : `Post job · ${usd(price || 0)}`}
          </button>
          {!items.length && <span className="small muted">Draft the checklist first.</span>}
        </section>
      </div>
    </main>
  );
}
