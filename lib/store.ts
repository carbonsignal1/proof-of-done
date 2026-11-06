// A small JSON-file store plus a photo folder. Fine for a demo; swap for a
// database and object storage in production.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { EventKind, Job } from "./types";

export interface DB {
  jobs: Job[];
}

export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), ".data");
const FILE = path.join(DATA_DIR, "db.json");
export const PHOTO_DIR = path.join(DATA_DIR, "photos");

const g = globalThis as unknown as { __podDB?: DB; __podLock?: Promise<unknown> };

export function load(): DB {
  if (g.__podDB) return g.__podDB;
  try {
    g.__podDB = JSON.parse(fs.readFileSync(FILE, "utf8")) as DB;
  } catch {
    g.__podDB = { jobs: [] };
  }
  return g.__podDB;
}

function save(db: DB) {
  g.__podDB = db;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

/** Serialise read-modify-write so two requests can't capture the same hold twice. */
export async function withDB<T>(fn: (db: DB) => Promise<T> | T): Promise<T> {
  const prev = g.__podLock ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((r) => (release = r));
  g.__podLock = prev.then(() => next);
  await prev;
  try {
    const db = load();
    const out = await fn(db);
    save(db);
    return out;
  } finally {
    release();
  }
}

export function resetAll() {
  fs.rmSync(PHOTO_DIR, { recursive: true, force: true });
  save({ jobs: [] });
}

export const newId = (prefix: string) => `${prefix}_${crypto.randomBytes(5).toString("hex")}`;

export function addEvent(job: Job, kind: EventKind, message: string, ref?: string) {
  job.events.push({ ts: new Date().toISOString(), kind, message, ref });
}

// ---- photos ----

const SAFE_NAME = /^[a-z0-9_-]+\.(jpg|png|webp)$/;

export function savePhoto(bytes: Buffer, mime: string): string {
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const name = `${newId("ph")}.${ext}`;
  fs.mkdirSync(PHOTO_DIR, { recursive: true });
  fs.writeFileSync(path.join(PHOTO_DIR, name), bytes);
  return name;
}

export function readPhoto(name: string): { bytes: Buffer; mime: "image/jpeg" | "image/png" | "image/webp" } | null {
  if (!SAFE_NAME.test(name)) return null;
  try {
    const bytes = fs.readFileSync(path.join(PHOTO_DIR, name));
    const mime = name.endsWith(".png") ? "image/png" : name.endsWith(".webp") ? "image/webp" : "image/jpeg";
    return { bytes, mime };
  } catch {
    return null;
  }
}
