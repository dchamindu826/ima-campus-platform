# IMA Campus Backend — Architecture & Refactor Plan

> **New Claude chat?** Give it this file first. It holds the whole plan, the rules,
> and what is already done, so nothing has to be re-explained.

## Why we are refactoring

Staff reports in the "Web & App Errors" group (June–Oct 2026) are not 1000 separate
bugs. They come from six root causes in the code:

| # | Root cause | Typical staff report |
|---|------------|----------------------|
| 1 | "Which classes can this student access?" is decided in ~10 places with different rules | "ghost login eken pennawa, lamayata pennanne na", "Sept witharak gewwa lamayata Oct live eka", "wena sirge rec eka" |
| 2 | Payment status changes have no rules (no state machine) | "approve wela aye pending", "2 parak approve wela", "approve + post pay dekema" |
| 3 | PayHere server notify never matches an order (`"ORD-..."` → `parseInt` → `NaN`) | "salli kapila, web eka ok wenne na" |
| 4 | Tute delivery is created once, at approve time only; failures are never retried | "approve wela, delivery hub eke na" |
| 5 | CRM lead status is a copied value, synced by hand | "full paid, eth non enrolled", "pay kala, Round 2 eke" |
| 6 | Every dashboard counts the same thing with its own query | "coordinator dashboard not tally with management" |

The fix is to give each concern **one owner module**, not to patch each report.

## Approach: replace step by step (strangler pattern)

We do **not** stop the system and rewrite it. New modules live in `backend/src/`
and run inside the same Express app, on the **same MySQL database and Prisma schema**
(no data migration). Old controllers are switched to call the new modules one by
one, then deleted.

```
backend/
  server.js                 ← old entry point (still runs everything)
  controllers/ routes/      ← OLD code, shrinks over time
  src/
    core/                   ← shared foundation (one DB client, auth, errors, events)
    modules/
      entitlement/          ← ✅ DONE (step 1)
      payments/             ← next
      delivery/
      content/
      crm/
      academic/  students/  auth/  physical/
      reports/              ← read-only stats, one query layer
```

## Rules every module follows

1. **Layers:** `routes.js → service.js → repository.js`, plus `rules.js` for pure logic.
   - `rules.js` — pure functions, **no database**, fully unit-tested. Business decisions live here.
   - `repository.js` — the only file that talks to Prisma.
   - `service.js` — loads data via the repository, applies the rules.
   - `routes.js` — HTTP only: parse input, check permission, call service.
2. **Ownership:** a table is written by exactly one module. Other modules ask that module.
   (e.g. only `payments` changes `Payment.status`.)
3. **One DB client:** always `require('../../core/db')`. Never `new PrismaClient()`.
   The old code created 80 clients — that is what causes "Too many connections".
4. **Permissions on every route:** `requireRole(...)` / `requireStudent` from `core/auth`.
   A route without one is a bug.
5. **Modules talk through events** for side effects: `payments` emits `payment.approved`;
   `delivery`, `crm` listen. No more copy-pasted `syncLeadEnrollment` calls.
6. **Tests first** for every rule, written from a real staff report.
   `npm test` must pass before anything goes live.
7. **No deploys during working hours** without a staging check.

## Step plan & status

| Step | Module | What it fixes | Status |
|------|--------|---------------|--------|
| 0 | `core` | single DB client, auth, errors, event bus, `/api/v2` | ✅ done |
| 1 | `entitlement` | one source of truth for student access; guards on leaking endpoints | ✅ done |
| 1.5 | security | staff gate on all staff APIs; 5 schema-mismatch crashes | ✅ done |
| 1.6 | process roles | background jobs run in a separate `worker` process (`IMA_ROLE`) | ✅ done (LMS/CRM split: later) |
| 2a | `payments` | online payments approved only by gateway confirmation; PayHere notify works; no double approve | ✅ done |
| 2b | `payments` | server-side price check (shadow → `PRICING_ENFORCE=true`) | ✅ done (shadow) |
| 3 | `delivery` | daily reconciliation: missing deliveries + orphan deliveries; staff API | ✅ done (report mode) |
| 4 | `content` | web + app use the same content API (no "web ok, app wrong") | |
| 5 | `crm` | lead enrollment status derived from entitlement, not copied | |
| 6 | `reports` | one query layer for all dashboards & stats | |
| 7 | cleanup | delete replaced controllers; remaining modules | |

## Entitlement rules (step 1)

Source of truth: `src/modules/entitlement/rules.js` (tested in `rules.test.js`).

Payment codes used in the DB:
- `payment_type`: `1` Monthly, `2` Installment, `3` Full
- `status`: `0` Pending, `1` Approved, `2` Rejected, `4` Post-pay (temporary), `5` Trash, `-2` Under-paid

A payment gives access when:
- status is `1` (Approved), **or**
- status is `4` (Post-pay) **and** `valid_until` is in the future (expired post-pay = no access,
  even if nobody opened the admin payments page).

An installment payment (`2`) gives no access while its batch is overdue, unless the student
also has an approved monthly/full payment for that batch.

Scope of access:
- **Monthly (1):** only the courses in the paid group (month), matching the paid subjects.
  Paying September never unlocks October.
- **Full / Installment (2, 3):** the paid subjects across the whole batch, same class type
  (theory / paper), matched by subject name/code.
- A payment with no subject list covers the whole group.

### What step 1 changed in the old code

- **All 80 `new PrismaClient()` → one shared client** (`src/core/db.js`). Some were created
  on every request in `adminController` / `aiVerificationController`.
- **Guards** (`src/modules/entitlement/guard.js`) on endpoints that served content without
  checking payment:
  - `GET /api/student/module/:id` (web) and `GET /api/mobile/module/:id` (app) — any course id
    returned that course's recordings and live links.
  - `GET /api/mobile/download-rec/:contentId` — any logged-in student could download any recording.
- **Content dedupe** (`src/modules/content/rules.js`): old code merged different lessons that had
  the same title, so students saw another lecturer's recording/link. Now title + media must match.
- **New support API** for staff: `GET /api/v2/entitlements/students/:studentId/courses/:courseId`
  answers "why can't this student see this class?" with a reason, no ghost login needed.

### Safe rollout (IMPORTANT)

Guards start in **shadow mode**: they never block, they log:

```
[entitlement:shadow] would deny student=123 course=45 reason=subject-or-month-not-paid
```

1. Deploy. Watch the server log for a few days.
2. For each "would deny" line, check: is the student really unpaid? If a paid student shows up,
   the rule is wrong — fix `rules.js` + add a test.
3. When the log only shows genuinely unpaid students, set `ENTITLEMENT_ENFORCE=true` in `.env`
   and restart. To roll back instantly, remove it and restart.

### Known leaks left for step 4 (content)

`GET /api/mobile/live-portal` and `GET /api/zoom-direct-link/:contentId` return Zoom links
**without any login**, because the app opens them in an external browser. They need signed,
short-lived links — done in the content module, together with an app update.

## Step 1.5 — security (done)

`src/core/staffGate.js` is mounted at the top of `server.js`. Any path under a staff prefix
(`/api/admin`, `/api/delivery`, `/api/team`, `/api/reminders`, CRM, call center, finance, ...)
now needs a valid token of a **non-student** account. Webhooks stay public.

Verified by probing all 666 routes with no token, a student token and a coordinator token:
- reachable without login: 77 → 33 (only intended public routes left)
- staff routes a student could reach: ~470 → 0
- staff routes the gate blocks for a coordinator: 0

Schema-mismatch crashes fixed: staff app dashboard (`Batch.is_active`, timetable fields),
`/api/admin/whatsapp-call/channels` (`User.username`), student chat businesses
(`Lead.businessId`), mobile Google sign-in (no `User.email` — now a clear message),
CRM campaign archive (no longer claims success while changing nothing), removed the
non-existent `staffKpi` write.

Still open (planned):
- `method: 'payhere'` in enrollment auto-approves on the client's word → **step 2**
  (together with the PayHere notify fix, otherwise genuine online payers lose access).
- `/api/mobile/live-portal`, `/api/zoom-direct-link/:id` need signed links → **step 4**.
- `/api/public/whatsapp-recording/:filename` serves call recordings without login → step 5.
- `freeSeminarController.archiveCampaign` is dead code (not routed) with the same bug.

## Step 1.6 — process roles (done)

`src/core/jobs.js`: every cron / repeating job is registered through `jobs.schedule()` /
`jobs.every()`. The same `server.js` runs in one of three roles via `IMA_ROLE`:

| IMA_ROLE | HTTP + sockets | background jobs |
|----------|----------------|-----------------|
| `all` (default, unset) | yes | yes — same as before |
| `api` | yes | no |
| `worker` | no port opened | yes |

Jobs (11, incl. delivery reconcile 01:00 UTC): free-seminar auto-assign (1 min), live-class reminders (1 min), AI slip
verification schedule (1 min), delivery status (hourly, 08:00), DB backup (02:30),
YouTube cookies, quota reset, custom task generator, auto round push (midnight).
The startup log prints `[jobs] role=... jobs=N/10 [...]`.

**Never run two processes with jobs on the same database** (e.g. `all` + `worker`, or a
test backend in `all` pointing at the production DB): every job would run twice.

Still to do (needs the nginx config): split `api` further into `lms` (students) and
`crm` (staff + WhatsApp webhooks + call sockets).

## Step 2a — payments (done)

`src/modules/payments/` — `rules.js` (pure), `service.js`, tests incl. an in-memory DB.

**Online payments (PayHere / Paycorp)** are approved ONLY when the gateway confirmed them
to this server. Server-side records live in the existing `AppSetting` table (no schema change):
- `pg:<gateway>:<ref>` — written when the payment page opens (PayHere hash / Paycorp init) and
  marked `verified` by PayHere notify (signature checked) or Paycorp complete (`responseCode 00`).
- `pg-used:<gateway>:<ref>` — unique key, so one gateway payment approves one enrollment only.

Flow: if the browser's enrollment call arrives first, the payment is saved **pending** with a
remark tag `[ONLINE:payhere:ORD-...] Waiting for gateway confirmation (reason)`. When PayHere's
notify arrives, it approves those pending payments (and runs delivery + CRM sync once).
Staff can search a payment's remark for that tag; if a gateway never confirms, check the
merchant portal and approve manually.

Covered: enrollment (`/enroll-with-slip`), due/installment (`/pay-due-online`), PayHere notify
(new `ORD-` orders + numeric due orders), Paycorp init/complete.

**Staff approvals** (`paymentAction`, `approveInstallment`, AI auto-verify): an already
approved payment can't be approved again (409), and status + wallet change in one
transaction only if nobody changed the payment meanwhile.

See step 2b for the enrollment amount.

## Step 2b — server-side price check (done, shadow mode)

`src/modules/payments/pricing.js` (pure, tested) computes what an enrollment should cost,
mirroring the web enrollment page: `course.groupPrices` → `course.price`, the group's
`discount_rules` (packagePrice / pricePerCourse / fixedDiscount, excluded courses don't count),
installment first phase, minus wallet balance. `priceCheck.js` runs it on every enrollment.

**Known difference:** the mobile app ignores `groupPrices` and the wallet, so app amounts can
differ from web amounts. Logs show `client=app|web` for each mismatch.

Rollout:
1. Shadow (default): nothing changes; the log shows
   `[pricing:shadow] UNDERPRICED student=.. client=.. claimed=.. expected=..`.
2. Check those lines for a few days. Genuine students showing up = a pricing rule is missing
   or the app price is wrong — fix that first.
3. Then set `PRICING_ENFORCE=true` in `.env`: underpriced online payments stay pending for staff,
   and underpriced slips get a `[PRICE CHECK]` remark. Remove it to roll back.

Not checked (skipped, logged): upgrade flows (monthly→full, multi-upgrade).

## Step 3 — delivery reconciliation (done, report mode)

Deliveries are still created at approval (`createAutoDeliveryForPayment`, unchanged rules),
but nothing ever retried a failure or noticed later changes. `src/modules/delivery/` now finds:

- **missing** — approved payment (last 90 days), tutes configured in Content Hub, no delivery.
  Uses `createAutoDeliveryForPayment(payment, false, { dryRun: true })`, so the same dedupe
  rules decide (no duplicates).
- **orphans** — delivery not shipped yet (`Pending`/`Hold`/`Packed`) whose payment was
  rejected or trashed.

Staff API (`requireStaff`):
- `GET  /api/v2/delivery/reconcile?days=90` → `{ missing: [...], orphans: [...] }`
- `POST /api/v2/delivery/reconcile/:paymentId/create` → creates the missing delivery
  (refuses if not approved, or if one already exists)

Worker job `delivery-reconcile-daily` (06:30 Sri Lanka) logs
`[delivery:reconcile] scanned=.. missing=.. orphans=..` plus the first 20 of each.
With `DELIVERY_AUTOFIX=true` it also creates the missing ones.

**Business rule (step 3b):** Discount and Free Card approvals are never auto-delivered — staff send them with "Send to Delivery". The report lists them separately as `awaitingManual` (kind `discount` / `free-card`), not as `missing`, and `createMissingDelivery` refuses them (`manual-only:<kind>`).

**Step 3c:** the usual cause of `missing` is a tute set in Content Hub after the payment was approved. With `DELIVERY_AUTOFIX=true` the daily job creates only those approved within `DELIVERY_AUTOFIX_DAYS` (default 7); older ones are left to the delivery team.

**Step 3d:** reconcile and create skip tutes the student already has in any live delivery (any payment/group), so a late fix never sends a tute twice (`already-delivered-elsewhere`).
Orphans are only reported — staff decide.

## Running tests

```
cd backend
npm test
```

Tests use Node's built-in test runner (no database needed for rules).
