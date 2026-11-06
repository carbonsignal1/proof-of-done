"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useJobs, useRole } from "./state";

export function Nav() {
  const path = usePathname();
  const { role, setRole } = useRole();
  const { data } = useJobs(5000);
  const reviews = data?.jobs.filter((j) => j.status === "review").length ?? 0;
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="brand">
          <span className="brand-mark">✓</span>
          Proof-of-Done
        </Link>
        <nav className="nav">
          <Link href="/" className={path === "/" ? "active" : ""}>
            Jobs
            {role === "poster" && reviews > 0 && <span className="badge">{reviews}</span>}
          </Link>
          <Link href="/new" className={path === "/new" ? "active" : ""}>Post a job</Link>
        </nav>
        <div className="modes" style={{ alignItems: "center" }}>
          <span className="role-label">Viewing as</span>
          <div className="seg" role="group" aria-label="Viewing as">
            <button className={role === "poster" ? "on" : ""} onClick={() => setRole("poster")}>Poster</button>
            <button className={role === "worker" ? "on" : ""} onClick={() => setRole("worker")}>Worker</button>
          </div>
          {data && (
            <>
              <span className={`pill ${data.modes.paypal === "sandbox" ? "accent" : "warn"}`}>PayPal: {data.modes.paypal === "sandbox" ? "Sandbox" : "Mock"}</span>
              <span className={`pill ${data.modes.ai === "claude" ? "accent" : "warn"}`}>AI: {data.modes.ai === "claude" ? "Claude" : "Mock"}</span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
