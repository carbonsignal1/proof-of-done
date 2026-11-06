"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useJobs, useRole } from "./state";

export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Proof-of-Done home">
      proof<i className="brand-dot" aria-hidden="true" /><em>done</em>
    </Link>
  );
}

export function Nav() {
  const path = usePathname();
  const landing = path === "/";
  const { role, setRole } = useRole();
  const { data } = useJobs(5000);
  const reviews = data?.jobs.filter((j) => j.status === "review").length ?? 0;

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Brand />
        <nav className={`nav ${landing ? "nav-landing" : ""}`}>
          {landing ? (
            <>
              <a href="#how">How it works</a>
              <a href="#faq">Questions</a>
              <Link href="/jobs">Job board</Link>
            </>
          ) : (
            <>
              <Link href="/jobs" className={path === "/jobs" || path.startsWith("/jobs/") ? "active" : ""}>
                Jobs
                {role === "poster" && reviews > 0 && <span className="badge">{reviews}</span>}
              </Link>
              <Link href="/new" className={path === "/new" ? "active" : ""}>Post a job</Link>
              <Link href="/ledger" className={path === "/ledger" ? "active" : ""}>Ledger</Link>
            </>
          )}
        </nav>
        <div className="modes">
          {landing ? (
            <Link href="/new" className="btn outline sm">Post a job</Link>
          ) : (
            <>
              <span className="role-label">Viewing as</span>
              <div className="seg" role="group" aria-label="Viewing as">
                <button className={role === "poster" ? "on" : ""} onClick={() => setRole("poster")}>Poster</button>
                <button className={role === "worker" ? "on" : ""} onClick={() => setRole("worker")}>Worker</button>
              </div>
              {data && (
                <>
                  <span className={`pill ${data.modes.paypal === "sandbox" ? "accent" : "warn"}`}>PayPal {data.modes.paypal === "sandbox" ? "Sandbox" : "Mock"}</span>
                  <span className={`pill ${data.modes.ai !== "mock" ? "accent" : "warn"}`}>AI {data.modes.ai === "gemini" ? "Gemini" : data.modes.ai === "claude" ? "Claude" : "Mock"}</span>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
