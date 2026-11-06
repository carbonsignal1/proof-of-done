"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Brand } from "@/components/Nav";

const CheckScene = dynamic(() => import("@/components/CheckScene"), {
  ssr: false,
  loading: () => <div className="ed-scene"><div className="scene-fallback"><span className="ed-fallback-check">✓</span></div></div>,
});
const DotSphere = dynamic(() => import("@/components/DotSphere"), { ssr: false });

const WORDS = ["desk", "lawn", "kitchen", "shelf", "garage", "laundry"];

/** Types and deletes the italic word in the headline, with a blinking caret. */
function Typewriter() {
  const [text, setText] = useState(WORDS[0]);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let i = 0, len = WORDS[0].length, deleting = true, timer = 0;
    const step = () => {
      const word = WORDS[i];
      if (deleting) {
        len--;
        if (len <= 0) { deleting = false; i = (i + 1) % WORDS.length; }
      } else {
        len++;
        if (len >= WORDS[i].length) { setText(WORDS[i]); deleting = true; timer = window.setTimeout(step, 2200); return; }
      }
      setText((deleting ? word : WORDS[i]).slice(0, Math.max(0, len)));
      timer = window.setTimeout(step, deleting ? 55 : 90);
    };
    timer = window.setTimeout(step, 2200);
    return () => clearTimeout(timer);
  }, []);
  return (
    <span className="ed-type">
      <em>{text}</em>
      <span className="ed-caret" aria-hidden="true" />
    </span>
  );
}

const PAY_WITH = [
  {
    word: "a hold",
    text: "Approve the payment once with PayPal. It's authorized, not charged, so the worker knows the money is real and you know it can't leave until the job is done.",
    tags: ["PayPal Checkout", "Orders v2 · AUTHORIZE", "Nothing charged yet", "Hold expires safely"],
  },
  {
    word: "a checklist",
    text: "Describe the job in your own words. AI turns it into a few checks a photo can prove, and you edit them, so both sides agree on what “done” means before work starts.",
    tags: ["Gemini", "Photo-checkable items", "Required vs optional", "Editable"],
  },
  {
    word: "photo proof",
    text: "The worker takes a before photo when they claim the job and an after photo when they finish. AI compares the two against every item and explains what it sees.",
    tags: ["Before & after", "Same-place check", "Specific feedback", "3 attempts"],
  },
  {
    word: "a release",
    text: "Every required item done: PayPal captures the hold and pays the worker. Not done in time, or cancelled: the hold is voided and you're never charged.",
    tags: ["Capture", "Payouts", "Void", "Full ledger"],
  },
];

function PayWith() {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(Number((e.target as HTMLElement).dataset.i))),
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);
  return (
    <section className="ed-paywith" id="how">
      <div className="ed-paywith-sticky">
        <h2 className="ed-xl">Pay with</h2>
      </div>
      <div>
        {PAY_WITH.map((p, i) => (
          <div key={p.word} ref={(el) => { refs.current[i] = el; }} data-i={i} className={`ed-pw-item ${active === i ? "on" : ""}`}>
            <div className="ed-xl ed-pw-word"><em>{p.word}</em></div>
            <p>{p.text}</p>
            <div className="ed-tags">{p.tags.map((t) => <span key={t}>{t}</span>)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

const SAMPLE_JOBS = [
  { t: "Tidy and clear my desk", p: 30, s: "Paid" },
  { t: "Mow the front lawn", p: 40, s: "Money held" },
  { t: "Assemble a bookshelf", p: 55, s: "In progress" },
  { t: "Clean up the kitchen", p: 35, s: "Paid" },
  { t: "Fold the laundry", p: 20, s: "Money held" },
  { t: "Wash the car", p: 25, s: "Paid" },
  { t: "Sort the garage", p: 60, s: "In progress" },
  { t: "Water the plants", p: 15, s: "Paid" },
];

const FAQ = [
  { q: "Is my money safe while the job is being done?", a: "Yes. PayPal only holds (authorizes) the payment. Nothing is charged until the work is verified, and if the deadline passes or you cancel, PayPal voids the hold." },
  { q: "What if the AI gets it wrong?", a: "The AI never moves money by itself. It describes what it sees; a small set of tested rules decides. If the AI isn't sure, or the worker runs out of attempts, you see both photos and make the final call." },
  { q: "Can a worker cheat with an old photo?", a: "The before photo is taken when they claim the job, and the AI checks that the after photo shows the same place by comparing things that don't move, like sockets, furniture and wall marks. Anything it can't see counts as not done." },
  { q: "How does the worker get paid?", a: "As soon as every required item checks out, PayPal captures the hold and sends the money to the worker with PayPal Payouts. The ledger shows every step with its PayPal reference." },
  { q: "Is this real PayPal?", a: "This demo runs on the PayPal Sandbox, PayPal's real test environment, with test accounts and test money. The same API calls work in production." },
  { q: "What kind of jobs work best?", a: "Anything where a photo can show the result: tidying, cleaning, mowing, assembling, organising. Jobs you can't photograph (like tutoring) aren't a good fit." },
];

export default function Landing() {
  return (
    <main className="ed">
      {/* ---------- hero ---------- */}
      <section className="ed-hero">
        <div className="ed-hero-copy">
          <h1 className="ed-display">
            Pay when the <Typewriter />
            <br />
            is actually done.
          </h1>
          <p className="ed-lede">
            Post a small job and PayPal holds the money. The worker sends photo proof, AI checks it against the checklist you both agreed on, and the payment is released only when the work is done.
          </p>
          <div className="row" style={{ gap: 12, marginTop: 26 }}>
            <Link href="/new" className="btn primary lg">Post a job</Link>
            <Link href="/jobs" className="btn outline lg">Browse jobs</Link>
          </div>
          <div className="ed-ribbons" aria-label="How it works">
            <span className="ed-ribbon gold"><small>Money held by</small>PayPal</span>
            <span className="ed-ribbon silver"><small>Proof checked by</small>AI</span>
          </div>
        </div>
        <CheckScene />
      </section>

      {/* ---------- story ---------- */}
      <section className="ed-story">
        <div className="ed-story-card">
          <div className="ed-mini">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="pill ok">Paid</span>
              <span className="small muted">Proof #2 · approved</span>
            </div>
            <div className="ed-mini-title">Clear off my desk</div>
            <div className="ed-mini-price">$30.00</div>
            {["Desk surface is completely empty", "No cables or chargers remain", "All personal items removed"].map((t) => (
              <div key={t} className="ed-mini-check"><span>✓</span>{t}</div>
            ))}
            <div className="ed-mini-foot"><span className="coin sm" /> Captured from the hold · paid to Sam</div>
          </div>
        </div>
        <div className="ed-story-copy">
          <h2 className="ed-lg">Here, <em>done</em> means done.</h2>
          <p>
            Paying for small jobs is a leap of faith. Pay first and you might get a half-done job; pay after and the worker might never see the money. Most of these jobs are still settled in cash, with no protection for either side.
          </p>
          <p>
            Proof-of-Done puts the money in the middle: held by PayPal, released by proof. The worker can see it's real, and you only pay for work you can see.
          </p>
          <Link href="#faq" className="btn outline">Good questions</Link>
        </div>
      </section>

      {/* ---------- dot sphere statement ---------- */}
      <section className="ed-sphere">
        <DotSphere />
        <h2 className="ed-xl ed-sphere-text">
          Both sides agree on <em>done</em>
          <br />
          before any money moves.
        </h2>
      </section>

      {/* ---------- pay with ---------- */}
      <PayWith />

      {/* ---------- dark collage ---------- */}
      <section className="ed-dark">
        <div className="ed-collage">
          <div className="ed-col">
            {SAMPLE_JOBS.slice(0, 4).map((j) => <JobTile key={j.t} {...j} />)}
          </div>
          <div className="ed-collage-center">
            <h2 className="ed-xl">
              Your next job
              <br />
              could be <em>here.</em>
            </h2>
            <Link href="/new" className="btn outline light">Post a job</Link>
          </div>
          <div className="ed-col ed-col-offset">
            {SAMPLE_JOBS.slice(4).map((j) => <JobTile key={j.t} {...j} />)}
          </div>
        </div>
      </section>

      {/* ---------- FAQ ---------- */}
      <section className="ed-faq" id="faq">
        <div>
          <h2 className="ed-xl">
            Good questions
            <br />
            deserve good <em>answers.</em>
          </h2>
          <p className="muted small" style={{ marginTop: 14 }}>The essentials, in plain words.</p>
        </div>
        <div className="ed-acc">
          {FAQ.map((f) => (
            <details key={f.q}>
              <summary>
                <span className="ed-plus" aria-hidden="true" />
                {f.q}
              </summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ---------- footer ---------- */}
      <footer className="ed-foot">
        <div className="ed-foot-grid">
          <div>
            <Brand />
            <p className="ed-foot-note">A payment that waits for the work. Built for the PayPal AI Hackathon on PayPal Sandbox, with AI photo checks.</p>
          </div>
          <nav className="ed-foot-links">
            <Link href="/jobs">Jobs</Link>
            <Link href="/new">Post a job</Link>
            <Link href="/ledger">Ledger</Link>
            <a href="#how">How it works</a>
            <a href="#faq">Questions</a>
          </nav>
          <div className="ed-foot-big">
            Pay when it&apos;s
            <br />
            <em>done.</em>
          </div>
        </div>
        <div className="ed-foot-bottom">
          <span>MIT licensed · Sandbox demo, no real money</span>
          <a href="https://github.com/carbonsignal1/proof-of-done">Source on GitHub</a>
        </div>
      </footer>
    </main>
  );
}

function JobTile({ t, p, s }: { t: string; p: number; s: string }) {
  return (
    <div className="ed-tile">
      <span className={`ed-tile-status ${s === "Paid" ? "paid" : ""}`}>{s}</span>
      <div className="ed-tile-title">{t}</div>
      <div className="ed-tile-price">${p}</div>
    </div>
  );
}
