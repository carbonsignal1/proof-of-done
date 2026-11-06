# Proof-of-Done

**Pay for small jobs only when they're actually done.**

Paying someone for a small job, like tidying a room, mowing a lawn or assembling a shelf, is a leap of faith. Pay first and you might get a half-done job. Pay after and the worker might never get paid.

Proof-of-Done fixes that with PayPal and AI:

1. **You post a job.** AI turns your description into a short checklist that a photo can prove ("Desk surface is clear", "Cables tidied away"). You edit it, so both sides agree on what "done" means before work starts.
2. **PayPal holds the money.** You approve the payment, but PayPal only *authorizes* it. Nothing is charged yet.
3. **The worker sends photo proof.** A "before" photo when they claim the job, an "after" photo when they finish.
4. **AI checks the proof.** Claude compares the photos against every checklist item and reports what it sees.
5. **Code decides the money:**
   - Every required item done, same place, high confidence → PayPal **captures** the hold and **pays the worker** through Payouts.
   - Something's missing → the worker gets specific feedback and can try again (3 attempts).
   - AI unsure, or out of attempts → the poster makes the final call.
   - Deadline passed or job cancelled → PayPal **voids** the hold. The poster is never charged.

> **AI judges the work. Code decides the money. PayPal holds and releases it.**

## PayPal integration

All calls go to the PayPal **Sandbox** REST API from [`lib/paypal.ts`](lib/paypal.ts).

| Step | PayPal API |
|---|---|
| Server auth | OAuth 2.0 client credentials (`/v1/oauth2/token`) |
| Poster approves the hold | PayPal JS SDK Buttons with `intent=authorize` |
| Create the hold | Orders v2 `POST /v2/checkout/orders` with `intent: AUTHORIZE` |
| Place the hold | `POST /v2/checkout/orders/{id}/authorize` |
| Release payment | `POST /v2/payments/authorizations/{id}/capture` |
| Cancel / expire | `POST /v2/payments/authorizations/{id}/void` |
| Pay the worker | Payouts `POST /v1/payments/payouts` |

Every money-moving call sends a `PayPal-Request-Id` idempotency key, and job state changes are serialised so a hold can't be captured twice.

## AI integration

[`lib/ai.ts`](lib/ai.ts) uses **Google Gemini** (via [`lib/gemini.ts`](lib/gemini.ts), with JSON-schema output) when `GEMINI_API_KEY` is set, or **Claude** (`claude-opus-5-5`, Anthropic TypeScript SDK with structured outputs) when `ANTHROPIC_API_KEY` is set. Every answer is validated against a Zod schema before the app uses it. For Gemini the app tries a list of models and skips any that are busy, rate limited or retired, so a demo doesn't stall on one overloaded model.

- **Checklist drafting:** job description → 3–5 visual, photo-checkable items marked required or optional.
- **Proof verification:** job, checklist, *before* and *after* photos → a verdict per item with evidence, a same-location check, a confidence level and feedback for the worker.

The AI never moves money. Its verdict goes to [`lib/rules.ts`](lib/rules.ts), plain unit-tested code that decides approve / reject / ask the poster. A missing or unclear verdict can never release a payment.

**Built-in defences against gaming the check:** the before photo is taken when the job is claimed, the AI checks both photos show the same place, unreadable items count as not done, text inside a photo is ignored as an instruction, and the poster always has the final say when the AI isn't sure.

## Payments ledger (AG Grid)

[`app/ledger/page.tsx`](app/ledger/page.tsx) shows every job's PayPal money trail in an **AG Grid Community** grid: order, hold (authorization), capture, payout batch and status, AI checks and outcome. It supports sorting, column filters, status quick-filters, search across names and PayPal IDs, and CSV export, with totals for money held, captured, paid out and released. Click a row to open the job.

## Run it locally

Requires Node 22.18 or later.

```bash
git clone <your-repo-url> proof-of-done
cd proof-of-done
npm install
cp .env.example .env.local   # fill in keys (optional, see below)
npm run dev                  # http://localhost:3000
```

| Variable | What it enables |
|---|---|
| `GEMINI_API_KEY` | Real Gemini checklists and photo checks (free tier works; get a key at aistudio.google.com). |
| `ANTHROPIC_API_KEY` | Use Claude instead of Gemini. With neither key, a template checklist is used and you pick the AI result from a menu (clearly labelled "mock"). |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | Real PayPal Sandbox holds, captures and voids. Without them, PayPal is simulated and labelled "mock". |
| `PAYPAL_PAYOUT_RECEIVER` | Default Sandbox account that receives worker payouts when the worker doesn't enter an email. |

### PayPal Sandbox setup

1. At [developer.paypal.com](https://developer.paypal.com) → **Apps & Credentials** (Sandbox) → create an app. Copy the Client ID and Secret.
2. In the app's settings, make sure **Payouts** is enabled.
3. Under **Testing Tools → Sandbox Accounts**, note a **Personal** account (to pay with) and another account's email (to receive payouts).
4. Test the hold flow end to end:

```bash
npm run check:paypal                                # creates a $1 AUTHORIZE order and prints an approve link
npm run check:paypal -- --hold <ORDER_ID>           # after approving: authorize, then void
npm run check:paypal -- --payout                    # $1 Sandbox payout
```

### Try the demo

The top bar has a **Viewing as Poster / Worker** switch so one person can play both sides.

1. **Poster → Post a job →** "Tidy and clear my desk", $30. Draft the checklist, post, and approve the PayPal hold.
2. **Worker →** open the job, take the *before* photo, claim it.
3. Send a half-done *after* photo → rejected with feedback ("cups still on the desk").
4. Send the finished photo → approved, PayPal captures and pays the worker.
5. Post a second job with the **5 minutes (demo: watch it expire)** deadline, approve the hold, and leave it: the hold is voided automatically.

Reset between runs with **Reset demo data** on the Jobs page or `npm run demo:reset`.

### Tests

```bash
npm test          # decision rule tests
npm run typecheck
```

## Deploy

[`render.yaml`](render.yaml) deploys to Render as a web service: New → Blueprint → pick this repo, then add the environment variables. Data is stored on local disk (`DATA_DIR`) and resets when a free instance restarts.

## Project layout

```
app/                  Next.js pages (landing, jobs board, post a job, job page, ledger) and API routes
lib/rules.ts          Decision rules: approve / reject / poster decides (pure, tested)
lib/ai.ts             Claude checklist drafting and photo verification
lib/paypal.ts         PayPal REST client: OAuth, Orders (authorize), capture, void, Payouts
lib/jobs.ts           Job lifecycle and every money movement
lib/store.ts          JSON + photo file storage
tests/                Rule tests
scripts/              PayPal Sandbox check, demo reset
```

## Limitations and what's next

- One shared demo space with a Poster/Worker switch instead of accounts.
- The poster pays the platform and the platform pays the worker. A production version would run on PayPal's marketplace product (PayPal Commerce Platform) so funds go to onboarded workers directly.
- PayPal authorizations are valid for a limited time, so job deadlines are kept short. Longer jobs would need reauthorization.
- Next: worker ratings, multiple photos per checklist item, video proof, and AI-suggested fair prices.

## License

MIT, see [LICENSE](LICENSE).
