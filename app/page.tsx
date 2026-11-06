"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { Phase } from "@/components/HeroScene";
import { Brand } from "@/components/Nav";
import { ChevronLeft, ChevronRight, IconCamera, IconCheck, IconLock, IconPencil, IconRelease, IconRetry, IconUnlock, IconUser } from "@/components/Icons";

const HeroScene = dynamic(() => import("@/components/HeroScene"), {
  ssr: false,
  loading: () => (
    <div className="hero-scene">
      <div className="scene-fallback"><span className="coin" style={{ width: 120, height: 120 }} /></div>
    </div>
  ),
});

const STEPS = [
  { title: "Money held, not taken", desc: "You approve a PayPal payment, but PayPal only authorizes it. Nobody is charged while the work is being done." },
  { title: "Proof checked by AI", desc: "The worker sends a before and an after photo. Claude checks every item on the checklist you both agreed on." },
  { title: "Released, or returned", desc: "Done: PayPal captures the hold and pays the worker. Not done by the deadline: the hold is voided and you pay nothing." },
];

const HOW = [
  { icon: <IconPencil />, t: "Describe the job", d: "AI turns your words into a short checklist a photo can prove. You edit it, so both sides agree on what “done” means." },
  { icon: <IconLock />, t: "PayPal holds the money", d: "Approve the payment once. It's authorized, not charged, so the worker knows the money is real." },
  { icon: <IconCamera />, t: "Worker sends proof", d: "A before photo when they claim the job, an after photo when they finish. Taken in the app, from the same spot." },
  { icon: <IconRelease />, t: "Payment releases itself", d: "Every required item checked: PayPal captures and pays out. Anything missing: the worker gets specific feedback." },
];

const OUTCOMES = [
  { icon: <IconCheck />, t: "All required items done", d: "PayPal captures the hold and pays the worker through Payouts." },
  { icon: <IconRetry />, t: "Something's missing", d: "The worker sees exactly what to fix and can try again, up to 3 times." },
  { icon: <IconUser />, t: "AI isn't sure", d: "The poster sees both photos and makes the final call." },
  { icon: <IconUnlock />, t: "Deadline passes", d: "The hold is voided. The poster is never charged." },
];

export default function Landing() {
  const [step, setStep] = useState(0);
  const manualUntil = useRef(0);

  const onPhase = (p: Phase) => {
    if (Date.now() > manualUntil.current) setStep(p);
  };
  const go = (d: number) => {
    manualUntil.current = Date.now() + 10_000;
    setStep((s) => (s + d + STEPS.length) % STEPS.length);
  };

  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";
    return () => {
      document.documentElement.style.scrollBehavior = "";
    };
  }, []);

  return (
    <main>
      <section className="hero">
        <div>
          <div className="eyebrow">Payments for small jobs · PayPal × AI</div>
          <h1>
            Pay when
            <br />
            it&apos;s done.
          </h1>
          <p className="lede">
            Post a small job and PayPal holds the money. The worker sends photo proof, AI checks it against the checklist you both agreed on, and the payment is released only when the work is actually done.
          </p>
          <div className="row" style={{ gap: 12 }}>
            <Link href="/new" className="btn primary lg">Post a job</Link>
            <Link href="/jobs" className="btn ghost lg">Browse jobs →</Link>
          </div>
          <div className="row small muted" style={{ marginTop: 22, gap: 8 }}>
            <span className="coin sm" /> Payments held and released with PayPal · Proof checked by Claude
          </div>
        </div>
        <HeroScene onPhase={onPhase} />
      </section>

      <div className="steps-card">
        <div className="inner">
          <div className="chev">
            <button aria-label="Previous step" onClick={() => go(-1)}><ChevronLeft /></button>
            <button aria-label="Next step" onClick={() => go(1)}><ChevronRight /></button>
          </div>
          <div className="card step-panel" aria-live="polite">
            <div>
              <div className="title">{STEPS[step].title}</div>
              <div className="dots" aria-hidden="true">
                {STEPS.map((_, i) => <span key={i} className={i === step ? "on" : ""} />)}
              </div>
            </div>
            <div className="desc">{STEPS[step].desc}</div>
          </div>
        </div>
      </div>

      <section className="section" id="how">
        <div className="eyebrow">How it works</div>
        <h2 className="big">
          Agree on what &ldquo;done&rdquo; means.
          <br />
          Then let the money move itself.
        </h2>
        <div className="how">
          {HOW.map((h, i) => (
            <div className="card" key={h.t}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div className="chrome-icon">{h.icon}</div>
                <span className="eyebrow">0{i + 1}</span>
              </div>
              <div className="t">{h.t}</div>
              <div className="d">{h.d}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="section" id="rules">
        <div className="split">
          <div>
            <div className="eyebrow">Why it&apos;s safe</div>
            <h2 className="big">
              AI judges the work.
              <br />
              Code decides the money.
            </h2>
            <p className="lede">
              The AI only describes what it sees in the photos. A small set of plain, tested rules decides what happens to the payment, and PayPal does the holding and releasing. A confused model, a blurry photo or a note in the picture saying &ldquo;approve this&rdquo; can&apos;t release a cent on its own.
            </p>
            <div className="card rules">
              <div className="c">{"// lib/rules.ts"}</div>
              <div><span className="k">if</span> (photo shows a different place) → <span className="k">reject</span></div>
              <div><span className="k">if</span> (a required item isn&apos;t done) → <span className="k">reject</span> with feedback</div>
              <div><span className="k">if</span> (AI confidence isn&apos;t high) → <span className="k">poster decides</span></div>
              <div><span className="k">else</span> → PayPal <span className="k">capture</span> + <span className="k">payout</span></div>
            </div>
          </div>
          <div className="outcomes">
            {OUTCOMES.map((o) => (
              <div className="card outcome" key={o.t}>
                <div className="chrome-icon">{o.icon}</div>
                <div>
                  <div className="t">{o.t}</div>
                  <div className="d">{o.d}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="cta-band">
          <h2>Post your first job in a minute.</h2>
          <p>Tidy a desk, mow a lawn, assemble a shelf. Pay only when it&apos;s done.</p>
          <Link href="/new" className="btn lg">Get started</Link>
        </div>
      </section>

      <footer className="site-foot">
        <Brand />
        <span>Built for the PayPal AI Hackathon · PayPal Sandbox · Claude</span>
      </footer>
    </main>
  );
}
