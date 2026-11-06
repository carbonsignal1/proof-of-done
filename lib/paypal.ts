// PayPal REST client (Sandbox).
//   OAuth 2.0 client credentials   POST /v1/oauth2/token
//   Hold the money                 POST /v2/checkout/orders (intent AUTHORIZE), POST /v2/checkout/orders/{id}/authorize
//   Release to the platform        POST /v2/payments/authorizations/{id}/capture
//   Cancel the hold                POST /v2/payments/authorizations/{id}/void
//   Pay the worker                 POST /v1/payments/payouts
// With no credentials the app runs in "mock" mode and labels every result as simulated.
import crypto from "node:crypto";

const BASE = process.env.PAYPAL_API_BASE || "https://api-m.sandbox.paypal.com";

export type PayPalMode = "sandbox" | "mock";

export function paypalMode(): PayPalMode {
  return process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET ? "sandbox" : "mock";
}

export function defaultPayoutReceiver(): string | undefined {
  return process.env.PAYPAL_PAYOUT_RECEIVER || undefined;
}

export class PayPalError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
    public debugId?: string,
  ) {
    super(message);
  }
}

let cachedToken: { token: string; expires: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now() + 60_000) return cachedToken.token;
  const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !json.access_token) {
    throw new PayPalError(`PayPal auth failed: ${json.error_description ?? res.statusText}`, res.status, json);
  }
  cachedToken = { token: json.access_token, expires: Date.now() + (json.expires_in ?? 300) * 1000 };
  return json.access_token;
}

async function call<T>(method: string, path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  const token = await accessToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(idempotencyKey ? { "PayPal-Request-Id": idempotencyKey } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const json = (text ? JSON.parse(text) : {}) as Record<string, unknown>;
  if (!res.ok) {
    const details = json.details as { issue?: string; description?: string }[] | undefined;
    const issue = details?.[0]?.description || details?.[0]?.issue;
    const msg = issue || (json.message as string) || (json.name as string) || res.statusText;
    throw new PayPalError(`PayPal ${method} ${path} failed: ${msg}`, res.status, json.details, res.headers.get("paypal-debug-id") ?? undefined);
  }
  return json as T;
}

const money = (n: number) => n.toFixed(2);
const mockId = (prefix: string) => `MOCK-${prefix}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

// ---- 1. Hold: create an AUTHORIZE order (buyer approves it in the PayPal popup) ----

export async function createHoldOrder(jobId: string, amount: number, description: string): Promise<{ id: string }> {
  return call<{ id: string }>(
    "POST",
    "/v2/checkout/orders",
    {
      intent: "AUTHORIZE",
      purchase_units: [
        {
          reference_id: jobId,
          custom_id: jobId,
          description: description.slice(0, 127),
          amount: { currency_code: "USD", value: money(amount) },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: "Proof-of-Done",
            user_action: "CONTINUE",
            shipping_preference: "NO_SHIPPING",
          },
        },
      },
    },
    `hold-order-${jobId}-${Date.now()}`,
  );
}

interface AuthorizeResponse {
  id: string;
  status: string;
  purchase_units: {
    reference_id?: string;
    payments?: { authorizations?: { id: string; status: string; expiration_time?: string; amount: { value: string } }[] };
  }[];
}

/** After the buyer approves: turn the order into an authorization (the hold). */
export async function authorizeOrder(orderId: string): Promise<{ authorizationId: string; expires?: string; amount: number; referenceId?: string }> {
  const res = await call<AuthorizeResponse>("POST", `/v2/checkout/orders/${encodeURIComponent(orderId)}/authorize`, {}, `authorize-${orderId}`);
  const unit = res.purchase_units?.[0];
  const auth = unit?.payments?.authorizations?.[0];
  if (!auth) throw new PayPalError("Authorize returned no authorization", 500, res);
  if (auth.status !== "CREATED" && auth.status !== "PENDING") {
    throw new PayPalError(`Authorization status is ${auth.status}`, 402, res);
  }
  return { authorizationId: auth.id, expires: auth.expiration_time, amount: Number(auth.amount.value), referenceId: unit?.reference_id };
}

export function mockHold(): { orderId: string; authorizationId: string; expires: string } {
  return {
    orderId: mockId("ORDER"),
    authorizationId: mockId("AUTH"),
    expires: new Date(Date.now() + 29 * 24 * 3600 * 1000).toISOString(),
  };
}

// ---- 2. Release: capture the held money ----

export async function captureHold(authorizationId: string, amount: number, mock: boolean): Promise<{ captureId: string; status: string }> {
  if (mock) return { captureId: mockId("CAPTURE"), status: "COMPLETED" };
  const res = await call<{ id: string; status: string }>(
    "POST",
    `/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/capture`,
    { amount: { currency_code: "USD", value: money(amount) }, final_capture: true },
    `capture-${authorizationId}`,
  );
  return { captureId: res.id, status: res.status };
}

// ---- 3. Cancel: void the hold so the payer is never charged ----

export async function voidHold(authorizationId: string, mock: boolean): Promise<void> {
  if (mock) return;
  await call("POST", `/v2/payments/authorizations/${encodeURIComponent(authorizationId)}/void`, undefined, `void-${authorizationId}`);
}

/** Current status of a payout (PENDING, SUCCESS, UNCLAIMED, FAILED...). */
export async function payoutStatus(batchId: string): Promise<string | undefined> {
  const res = await call<{ batch_header?: { batch_status?: string }; items?: { transaction_status?: string }[] }>(
    "GET",
    `/v1/payments/payouts/${encodeURIComponent(batchId)}`,
  );
  return res.items?.[0]?.transaction_status ?? res.batch_header?.batch_status;
}

// ---- 4. Pay the worker ----

export async function payWorker(opts: {
  receiver: string;
  amount: number;
  note: string;
  jobId: string;
  mock: boolean;
}): Promise<{ batchId: string; status: string }> {
  if (opts.mock) return { batchId: mockId("PAYOUT"), status: "SUCCESS" };
  const res = await call<{ batch_header: { payout_batch_id: string; batch_status: string } }>(
    "POST",
    "/v1/payments/payouts",
    {
      sender_batch_header: {
        sender_batch_id: `pod-${opts.jobId}`,
        email_subject: "You've been paid for a Proof-of-Done job",
        email_message: opts.note.slice(0, 255),
      },
      items: [
        {
          recipient_type: "EMAIL",
          amount: { value: money(opts.amount), currency: "USD" },
          receiver: opts.receiver,
          note: opts.note.slice(0, 255),
          sender_item_id: opts.jobId,
        },
      ],
    },
    `payout-${opts.jobId}`,
  );
  return { batchId: res.batch_header.payout_batch_id, status: res.batch_header.batch_status };
}
