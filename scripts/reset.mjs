// Wipe local demo data (jobs and photos) between video takes.
// Usage: npm run demo:reset   (works whether or not the server is running)
const port = process.env.PORT || 3000;
try {
  const res = await fetch(`http://localhost:${port}/api/reset`, { method: "POST" });
  if (res.ok) {
    console.log(`Demo data reset via the running server on port ${port}.`);
    process.exit(0);
  }
} catch {
  /* server not running: delete the files directly */
}
const fs = await import("node:fs");
const path = await import("node:path");
const dir = process.env.DATA_DIR || path.join(process.cwd(), ".data");
fs.rmSync(dir, { recursive: true, force: true });
console.log(`Deleted ${dir}. Restart the server if it was running on another port.`);
