# Devpost submission kit: Proof-of-Done

Everything to paste into the Devpost form, plus the video script and a pre-submit checklist.
Fill in the `<...>` placeholders. Deadline: **Wednesday, November 11**. Aim to submit Tuesday night.

---

## Project name
Proof-of-Done

## Tagline (short description)
Pay for small jobs only when they're done: PayPal holds the money, AI checks the photo proof.

## Prizes to select
- Most Creative
- Best Use of PayPal + AI
- Most Impactful
- Best Demo Delivery
- **Best Use of AG Grid** (payments ledger)
- Best Use of Render (if deployed on Render)

---

## About the project (Devpost "Story")

### Inspiration
Paying someone for a small job is a leap of faith. You hire a neighbour to tidy the garage or mow the lawn, and someone has to trust first. Pay up front and you might get a half-done job. Pay afterwards and the worker might never see the money. Most of these jobs are settled in cash or by bank transfer with no protection for either side.

We wanted a payment that waits for the work, and a fair, fast way to decide when the work is done.

### What it does
Proof-of-Done holds the payment for a small job and releases it only when photo proof shows the work is finished.

1. **Describe the job.** AI turns a plain description ("tidy my desk, take the cups to the kitchen") into a short checklist that a photo can prove, such as "Desk surface is clear" and "No cups left on the desk". The poster edits it, so both sides agree on what "done" means before work starts.
2. **PayPal holds the money.** The poster approves a PayPal payment, but it's only *authorized*. Nobody is charged while the work is being done, and the worker can see the money is real.
3. **The worker sends proof.** A *before* photo when they claim the job, and an *after* photo when they finish.
4. **AI checks the proof.** The AI compares the two photos against every checklist item and explains what it sees.
5. **Code decides the money:**
   - Every required item done, same place, high confidence → PayPal **captures** the hold and **pays the worker** through Payouts.
   - Something's missing → the worker gets specific feedback ("the cups are still on the desk") and can try again.
   - The AI isn't sure, or the worker runs out of attempts → the poster sees both photos and makes the final call.
   - Job cancelled or deadline passed → PayPal **voids** the hold. The poster is never charged.

**AI judges the work. Code decides the money. PayPal holds and releases it.**

### How we built it
- **Next.js + TypeScript** web app and API, deployed on Render.
- **PayPal (Sandbox)**, all from our own server code:
  - PayPal JS SDK buttons with `intent=authorize`, so the poster approves a *hold*, not a charge
  - Orders v2 with `intent: AUTHORIZE`, then **authorize**, **capture** or **void** on the authorization
  - **Payouts** to pay the worker after the capture
  - OAuth client credentials, and `PayPal-Request-Id` idempotency keys on every call that moves money
- **Google Gemini** for the AI, with a strict JSON schema for every answer:
  - Checklist drafting from the job description
  - Proof checking: before and after photos in, a verdict per checklist item out, plus a same-place check, a confidence level and feedback for the worker
  - Every answer is validated before the app uses it. If Gemini is overloaded, the app falls back to another Gemini model so the check doesn't stall.
- **AG Grid (Community)** for the **Payments ledger**: every job's PayPal money trail (order, hold, capture, payout, or release) in one grid, with sorting, column filters, status quick-filters, search across PayPal IDs, CSV export, and totals for money held, captured, paid out and released. Rows open the job, and the grid follows the app's light and dark theme.
- **Decision rules** in plain, unit-tested TypeScript (`lib/rules.ts`). The AI never moves money. Its verdict is input to these rules, and a missing or unclear verdict can never release a payment.

### Challenges we ran into
- **Where to put trust.** It's tempting to let the AI say "approve". Instead, the AI only describes what it sees, and a small set of tested rules turns that into approve, reject or ask the poster. This also protects against tricks like a note in the photo saying "approve this".
- **Cheating the photo check.** We take the before photo when the job is claimed, ask the AI whether both photos show the same place, count anything it can't see as not done, and keep the poster as the final judge whenever the AI is unsure. In testing, the AI flagged unrelated images as "not the right place" and rejected them.
- **Real-world PayPal limits.** Our first Sandbox accounts were in India, where payments between two Indian accounts aren't allowed, so checkout failed. Moving the merchant to a US Sandbox account fixed it.
- **AI models that are busy or retired.** Some Gemini models were overloaded or no longer available to new keys during the hackathon. We added a timeout and a fallback list so a demo never hangs on one model.

### Accomplishments that we're proud of
- The full money flow works end to end in PayPal Sandbox: hold → reject → retry → capture → payout, plus void on cancel or expiry. We checked every step against PayPal's own records.
- The rejection with feedback feels like a helpful coach rather than an error, and the worker knows exactly what to fix.
- A payment flow that is safe even when the AI is wrong: the worst an AI mistake can do is send a decision to the poster.

### What we learned
For AI that touches money, the safety boundary has to sit outside the model. AI is great at judging a photo, while plain code and a payment platform's hold-and-capture flow are what make it safe to act on that judgement.

### What's next for Proof-of-Done
- Run on PayPal's marketplace product (Commerce Platform), so payments go straight to onboarded workers.
- Worker ratings and repeat hiring.
- Several photos per checklist item, and short video proof.
- AI-suggested fair prices for common jobs.

### Built with
`typescript` `next.js` `react` `node.js` `paypal-orders-api` `paypal-payouts-api` `paypal-js-sdk` `google-gemini` `ag-grid` `render`

### Tools (required field: AI tools and how they were used)
- **Google Gemini (Gemini API):** powers the app's AI. It drafts the job checklist and checks before/after photos against it, returning structured JSON verdicts.
- **Claude Code (Anthropic):** helped design, write and test the application code.

### Links
- Hosted demo: `<https://your-app.onrender.com>`
- Code: https://github.com/carbonsignal1/proof-of-done
- Video: `<https://youtu.be/...>`

---

## Video script (target 2:45, hard limit 3:00)

Record in short clips and edit them together. Before each take, run **Reset demo data** (bottom of the Jobs page). If you're using a hosted demo, open the URL a minute early so the server is awake. Use **two browser windows side by side**: Poster on the left and Worker on the right (use the "Viewing as" switch), or record the worker part on your phone.

| Time | Screen | Do | Say |
|---|---|---|---|
| 0:00–0:15 | Landing page (3D hero) | Let the coin hover, then land on the blocks | "Paying someone for a small job is a leap of faith. Proof-of-Done holds the money with PayPal and releases it only when the work is actually done." |
| 0:15–0:40 | **Post a job** | Click "Tidy and clear my desk", then **Draft checklist with AI**, then **Post job · $30** | "I describe the job. AI turns it into a checklist a photo can prove, and I can edit it, so we both agree on what 'done' means." |
| 0:40–1:00 | Job page → PayPal popup | Click the **PayPal** button, log in with the Sandbox buyer, Continue | "I approve $30, but PayPal only *holds* it. Nothing is charged yet." Point at "Held by PayPal. Not charged yet." |
| 1:00–1:20 | Switch to **Worker** | Enter a name, take the **before** photo (messy desk), **Claim job** | "The worker claims the job and photographs the desk before starting." |
| 1:20–1:50 | Worker: proof #1 | Upload the half-done photo, then **Submit proof** | "First try: the AI spots the cups still on the desk. No money moves, and the worker gets specific feedback." Point at the red item. |
| 1:50–2:15 | Worker: proof #2 | Upload the tidy photo, then **Submit proof** | "Second try: every item checks out. PayPal captures the hold and pays the worker through Payouts." Point at the green ticks, the capture ID and the timeline. |
| 2:15–2:30 | Second job (prepared earlier) | Show a job that expired, or click **Cancel & release hold** | "If the job isn't done or is cancelled, the hold is released. The poster is never charged." |
| 2:30–2:38 | **Ledger** (AG Grid) | Click **Paid**, search a PayPal ID, show the totals | "Every dollar is traceable: the ledger shows each job's PayPal hold, capture and payout." |
| 2:38–2:45 | Landing, "Why it's safe" section | Scroll to the rules card | "AI judges the work. Code decides the money. PayPal holds and releases it." |

Upload to YouTube as **Public**, with no copyrighted music. Don't show `.env.local`, API keys, or your Sandbox account passwords on screen.

---

## Pre-submit checklist

- [ ] Demo photos tested: half-done photo rejected, tidy photo approved (Phase 3)
- [ ] PayPal button popup tested in the app (hold shows as "money held")
- [ ] Top bar reads **PayPal Sandbox** and **AI Gemini** in the video, not "Mock"
- [ ] Public GitHub repo with the MIT license showing in the About section
- [ ] Deployed to Render with the env vars set; the full flow works on the hosted URL in a private window
- [ ] README setup steps checked from a fresh clone
- [ ] Video under 3:00, public on YouTube
- [ ] Devpost form filled from this file, prizes selected
- [ ] Submitted by **Tuesday night** (deadline Wednesday, November 11)
- [ ] After the hackathon: delete and recreate the Gemini key (it was shared in chat)
