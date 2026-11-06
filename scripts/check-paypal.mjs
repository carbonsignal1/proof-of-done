// PayPal Sandbox smoke test for the hold -> capture/void flow.
//   npm run check:paypal                          OAuth + create a $1 AUTHORIZE order, prints the approve link
//   npm run check:paypal -- --hold ORDER_ID        after approving: authorize it, then VOID it (release)
//   npm run check:paypal -- --hold ORDER_ID --capture   ...or authorize and CAPTURE it
//   npm run check:paypal -- --payout               send a $1 Sandbox payout to PAYPAL_PAYOUT_RECEIVER
// Sandbox only.

const BASE = process.env.PAYPAL_API_BASE || "https://api-m.sandbox.paypal.com";
const { PAYPAL_CLIENT_ID: id, PAYPAL_CLIENT_SECRET: secret, PAYPAL_PAYOUT_RECEIVER: receiver } = process.env;
const args = process.argv.slice(2);
const ok = (m) => console.log(`  ✔ ${m}`);
const fail = (m) => {
  console.log(`  ✘ ${m}`);
  process.exitCode = 1;
};

async function call(token, method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  const why = json.details?.[0]?.description || json.message || json.name || res.statusText;
  return { ok: res.ok, status: res.status, json, why, debugId: res.headers.get("paypal-debug-id") };
}

console.log(`PayPal Sandbox check (${BASE})`);
if (!id || !secret) {
  fail("PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are not set (put them in .env.local).");
  process.exit(1);
}

const auth = await fetch(`${BASE}/v1/oauth2/token`, {
  method: "POST",
  headers: { Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
  body: "grant_type=client_credentials",
});
const authJson = await auth.json().catch(() => ({}));
if (!auth.ok) {
  fail(`OAuth failed (${auth.status}): ${authJson.error_description ?? JSON.stringify(authJson)}`);
  process.exit(1);
}
ok("OAuth token issued");
const token = authJson.access_token;
if (String(authJson.scope ?? "").includes("payouts")) ok("App has the Payouts scope");
else console.log("  ! Payouts scope not listed. Turn on Payouts in the app's settings or workers won't receive money.");

const holdIdx = args.indexOf("--hold");
if (holdIdx !== -1) {
  const orderId = args[holdIdx + 1];
  const a = await call(token, "POST", `/v2/checkout/orders/${orderId}/authorize`, {});
  if (!a.ok) {
    fail(`Authorize failed (${a.status}): ${a.why} debug-id ${a.debugId}`);
    process.exit();
  }
  const authz = a.json.purchase_units?.[0]?.payments?.authorizations?.[0];
  ok(`Authorized (money held): ${authz?.id} status ${authz?.status}, expires ${authz?.expiration_time}`);
  if (args.includes("--capture")) {
    const c = await call(token, "POST", `/v2/payments/authorizations/${authz.id}/capture`, { final_capture: true });
    if (c.ok) ok(`Captured ${c.json.id} (${c.json.status})`);
    else fail(`Capture failed (${c.status}): ${c.why} debug-id ${c.debugId}`);
  } else {
    const v = await call(token, "POST", `/v2/payments/authorizations/${authz.id}/void`);
    if (v.ok) ok("Voided: hold released, payer not charged");
    else fail(`Void failed (${v.status}): ${v.why} debug-id ${v.debugId}`);
  }
  process.exit();
}

const order = await call(token, "POST", "/v2/checkout/orders", {
  intent: "AUTHORIZE",
  purchase_units: [{ description: "Proof-of-Done smoke test", amount: { currency_code: "USD", value: "1.00" } }],
});
if (order.ok) {
  ok(`Created AUTHORIZE order ${order.json.id}`);
  const approve = order.json.links?.find((l) => l.rel === "approve" || l.rel === "payer-action");
  if (approve) {
    console.log(`    1. Open and approve with a Sandbox *personal* account: ${approve.href}`);
    console.log(`    2. Then: npm run check:paypal -- --hold ${order.json.id}            (tests void)`);
    console.log(`       or:   npm run check:paypal -- --hold ${order.json.id} --capture  (tests capture)`);
  }
} else fail(`Create order failed (${order.status}): ${order.why} debug-id ${order.debugId}`);

if (args.includes("--payout")) {
  if (!receiver) fail("PAYPAL_PAYOUT_RECEIVER is not set.");
  else {
    const p = await call(token, "POST", "/v1/payments/payouts", {
      sender_batch_header: { sender_batch_id: `smoke-${Date.now()}`, email_subject: "Proof-of-Done smoke test" },
      items: [{ recipient_type: "EMAIL", amount: { value: "1.00", currency: "USD" }, receiver, sender_item_id: `smoke-${Date.now()}` }],
    });
    if (p.ok) ok(`Payout batch ${p.json.batch_header?.payout_batch_id} (${p.json.batch_header?.batch_status})`);
    else fail(`Payout failed (${p.status}): ${p.why} debug-id ${p.debugId}`);
  }
}
