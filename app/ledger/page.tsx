"use client";
// Payments ledger: every job's money trail (hold → capture → payout, or void),
// shown in an AG Grid with sorting, filtering, search and CSV export.
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AgGridReact } from "ag-grid-react";
import type { ColDef, ICellRendererParams, RowClickedEvent, ValueFormatterParams } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";
import { StatusPill, usd, useJobs } from "@/components/state";
import type { Job, JobStatus } from "@/lib/types";

type Row = {
  id: string;
  title: string;
  status: JobStatus;
  amount: number;
  poster: string;
  worker: string;
  created: string;
  deadline: string;
  attempts: number;
  lastDecision: string;
  aiModel: string;
  mode: string;
  order: string;
  hold: string;
  capture: string;
  payout: string;
  payoutStatus: string;
  outcome: string;
};

const FILTERS: { key: string; label: string; match: (s: JobStatus) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "held", label: "Money held", match: (s) => s === "open" || s === "claimed" || s === "review" },
  { key: "review", label: "Needs decision", match: (s) => s === "review" },
  { key: "paid", label: "Paid", match: (s) => s === "paid" },
  { key: "released", label: "Released", match: (s) => s === "cancelled" },
];

function toRow(j: Job): Row {
  const last = j.attempts[j.attempts.length - 1];
  return {
    id: j.id,
    title: j.title,
    status: j.status,
    amount: j.price,
    poster: j.posterName,
    worker: j.worker?.name ?? "",
    created: j.createdAt,
    deadline: j.deadline,
    attempts: j.attempts.length,
    lastDecision: last ? (last.decision === "approve" ? "Approved" : last.decision === "reject" ? "Rejected" : "To poster") : "",
    aiModel: last?.model ?? "",
    mode: j.paypal.mock ? "Mock" : j.paypal.authorizationId ? "Sandbox" : "",
    order: j.paypal.orderId ?? "",
    hold: j.paypal.authorizationId ?? "",
    capture: j.paypal.captureId ?? "",
    payout: j.paypal.payoutBatchId ?? "",
    payoutStatus: j.paypal.payoutStatus ?? "",
    outcome: j.closedReason ?? "",
  };
}

const dateFmt = (p: ValueFormatterParams<Row, string>) =>
  p.value ? new Date(p.value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
const moneyFmt = (p: ValueFormatterParams<Row, number>) => (typeof p.value === "number" ? usd(p.value) : "");

function StatusCell(p: ICellRendererParams<Row, JobStatus>) {
  return p.value ? <StatusPill status={p.value} /> : null;
}

function IdCell(p: ICellRendererParams<Row, string>) {
  return p.value ? <span className="mono">{p.value}</span> : <span className="muted">—</span>;
}

export default function LedgerPage() {
  const router = useRouter();
  const { data } = useJobs(3000);
  const grid = useRef<AgGridReact<Row>>(null);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const jobs = data?.jobs ?? [];
  const rows = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter) ?? FILTERS[0];
    return jobs.filter((j) => f.match(j.status)).map(toRow);
  }, [jobs, filter]);

  const totals = useMemo(() => {
    const sum = (fn: (j: Job) => boolean) => jobs.filter(fn).reduce((s, j) => s + j.price, 0);
    return {
      held: sum((j) => ["open", "claimed", "review"].includes(j.status)),
      captured: sum((j) => Boolean(j.paypal.captureId)),
      paidOut: sum((j) => j.paypal.payoutStatus === "SUCCESS" || (j.paypal.mock && Boolean(j.paypal.payoutBatchId))),
      released: sum((j) => j.status === "cancelled" && Boolean(j.paypal.authorizationId)),
    };
  }, [jobs]);

  const columns = useMemo<ColDef<Row>[]>(
    () => [
      { field: "title", headerName: "Job", pinned: "left", minWidth: 190, flex: 1.4, filter: "agTextColumnFilter" },
      { field: "status", headerName: "Status", cellRenderer: StatusCell, minWidth: 170, filter: "agTextColumnFilter" },
      { field: "amount", headerName: "Amount", valueFormatter: moneyFmt, type: "rightAligned", minWidth: 110, filter: "agNumberColumnFilter" },
      { field: "poster", headerName: "Poster", minWidth: 110 },
      { field: "worker", headerName: "Worker", minWidth: 110 },
      { field: "attempts", headerName: "AI checks", type: "rightAligned", minWidth: 110, filter: "agNumberColumnFilter" },
      { field: "lastDecision", headerName: "Last AI decision", minWidth: 150 },
      { field: "aiModel", headerName: "AI model", minWidth: 150, hide: false },
      { field: "mode", headerName: "PayPal", minWidth: 100 },
      { field: "order", headerName: "Order", cellRenderer: IdCell, minWidth: 190 },
      { field: "hold", headerName: "Hold (authorization)", cellRenderer: IdCell, minWidth: 200 },
      { field: "capture", headerName: "Capture", cellRenderer: IdCell, minWidth: 190 },
      { field: "payout", headerName: "Payout batch", cellRenderer: IdCell, minWidth: 170 },
      { field: "payoutStatus", headerName: "Payout status", minWidth: 140 },
      { field: "outcome", headerName: "Outcome", minWidth: 180 },
      { field: "created", headerName: "Posted", valueFormatter: dateFmt, minWidth: 150, sort: "desc", filter: "agDateColumnFilter" },
      { field: "deadline", headerName: "Deadline", valueFormatter: dateFmt, minWidth: 150, filter: "agDateColumnFilter" },
    ],
    [],
  );

  const defaultColDef = useMemo<ColDef<Row>>(() => ({ sortable: true, resizable: true, filter: true, minWidth: 100 }), []);

  return (
    <main className="page">
      <div className="job-head" style={{ marginBottom: 18 }}>
        <div>
          <div className="eyebrow">Payments ledger</div>
          <h1 style={{ marginTop: 6 }}>Every dollar, every step</h1>
          <p className="lede" style={{ marginBottom: 0 }}>
            Each job&apos;s PayPal money trail: held, captured and paid out, or released. Click a row to open the job.
          </p>
        </div>
        <button className="btn" onClick={() => grid.current?.api.exportDataAsCsv({ fileName: "proof-of-done-ledger.csv" })} disabled={!rows.length}>
          Export CSV
        </button>
      </div>

      <div className="stats" style={{ marginBottom: 18 }}>
        <div className="card stat"><div className="k">Held by PayPal now</div><div className="v row" style={{ gap: 8 }}><span className="coin sm" />{usd(totals.held)}</div></div>
        <div className="card stat"><div className="k">Captured after proof</div><div className="v">{usd(totals.captured)}</div></div>
        <div className="card stat"><div className="k">Paid out to workers</div><div className="v">{usd(totals.paidOut)}</div></div>
        <div className="card stat"><div className="k">Holds released</div><div className="v">{usd(totals.released)}</div></div>
      </div>

      <div className="ledger-bar">
        <div className="seg" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button key={f.key} className={filter === f.key ? "on" : ""} onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
        <input
          className="ledger-search"
          type="search"
          placeholder="Search jobs, people, PayPal IDs…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search the ledger"
        />
      </div>

      <div className="ag-theme-quartz ledger-grid">
        <AgGridReact<Row>
          ref={grid}
          rowData={rows}
          columnDefs={columns}
          defaultColDef={defaultColDef}
          quickFilterText={search}
          getRowId={(p) => p.data.id}
          domLayout="autoHeight"
          rowHeight={48}
          animateRows
          suppressCellFocus
          overlayNoRowsTemplate={data ? "No jobs match. Post one from “Post a job”." : "Loading…"}
          onRowClicked={(e: RowClickedEvent<Row>) => e.data && router.push(`/jobs/${e.data.id}`)}
        />
      </div>
      <p className="footer-note">Ledger grid built with AG Grid Community.</p>
    </main>
  );
}
