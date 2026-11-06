"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { Job, JobStatus } from "@/lib/types";

export interface Modes {
  paypal: "sandbox" | "mock";
  ai: "gemini" | "claude" | "mock";
  model: string;
  payoutReceiverConfigured: boolean;
}

export type Role = "poster" | "worker";

const RoleCtx = createContext<{ role: Role; setRole: (r: Role) => void }>({ role: "poster", setRole: () => {} });

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRoleState] = useState<Role>("poster");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("pod-role");
      if (saved === "poster" || saved === "worker") setRoleState(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);
  const setRole = (r: Role) => {
    setRoleState(r);
    try {
      localStorage.setItem("pod-role", r);
    } catch {
      /* ignore */
    }
  };
  return <RoleCtx.Provider value={{ role, setRole }}>{children}</RoleCtx.Provider>;
}

export const useRole = () => useContext(RoleCtx);

/** Polls the job list (and modes) so poster and worker screens stay in sync. */
export function useJobs(intervalMs = 2500) {
  const [data, setData] = useState<{ jobs: Job[]; modes: Modes } | null>(null);
  const alive = useRef(true);
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs", { cache: "no-store" });
      if (res.ok && alive.current) setData(await res.json());
    } catch {
      /* keep last */
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    refresh();
    const t = setInterval(refresh, intervalMs);
    return () => {
      alive.current = false;
      clearInterval(t);
    };
  }, [refresh, intervalMs]);
  return { data, refresh };
}

export const usd = (n: number) => `$${n.toFixed(2)}`;

export function timeAgo(iso: string) {
  const s = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function timeLeft(iso: string) {
  const s = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  if (s <= 0) return "deadline passed";
  if (s < 60) return `${s}s left`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m left`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ${m % 60}m left`;
  return `${Math.floor(h / 24)} days left`;
}

const STATUS: Record<JobStatus, { label: string; cls: string }> = {
  awaiting_hold: { label: "Needs payment hold", cls: "warn" },
  open: { label: "Open · money held", cls: "accent" },
  claimed: { label: "In progress", cls: "accent" },
  review: { label: "Poster decides", cls: "warn" },
  paid: { label: "Paid", cls: "ok" },
  cancelled: { label: "Hold released", cls: "" },
};

export function StatusPill({ status }: { status: JobStatus }) {
  const s = STATUS[status];
  return <span className={`pill ${s.cls}`}>{s.label}</span>;
}
