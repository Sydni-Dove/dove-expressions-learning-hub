# Voice integrations: payment, booking, consultation

Audited October 29, 2026 against the live WordPress site (read-only) and this repository.

## What was verified on doveexpressions.org
- **Booking pages are Google Calendar appointment schedules in an iframe** (`/book-45/`, `/book-60/`, `/book-demo/`,
  `/book-consultation/`). No booking plugin (Amelia, Bookly, etc.) is installed.
- Google appointment schedules book **single appointments**. They have no recurring or alternating-week booking, no
  lesson credits, and no check that the visitor has paid. The `/book-45/` and `/book-60/` pages say "for enrolled students"
  and "paid in advance" but nothing enforces it: anyone with the link can book.
- **Payment is WooCommerce** (Stripe, Square and WooPayments gateways active). Vocal products exist in category
  "Vocal Coaching" (IDs below). Products have **no SKUs**, so entitlements must be keyed by product ID.
- The consultation form is a Google Form (not Elementor); FluentSMTP handles site email.

## Decision: where each thing lives
| Concern | Source of truth |
|---|---|
| Payment | WooCommerce (not duplicated in the Hub) |
| Entitlement (lessons purchased, expiry, payment status) | `dp_coaching_packages`, written from WooCommerce orders |
| Recurring weekly / alternating-week schedule | Learning Hub `dp_coaching_plans` + generated `dp_sessions` |
| Outcome (completed, cancelled, late, missed) and credit use | `dp_sessions.appointment_status` |
| One-off ad hoc booking (consultation, demo) | Google Calendar appointment schedules (unchanged) |

Recurring students therefore do **not** use the Google booking pages for their standing slot; the instructor sets the
slot once in the command center and the Hub generates the lessons (weekly: every 7 days; alternating: every 14 days,
with two students sharing one slot in opposite weeks, 12 alternating students = 6 positions). The database refuses
overlapping slots.

## WooCommerce -> Hub (built, not enabled)
`POST /api/webhooks/woocommerce` verifies WooCommerce's HMAC signature, maps products to the Hub packages, matches the buyer by
billing email to a Hub account, and calls `dp_record_package_purchase` (service role only, idempotent by order and line item;
status changes such as refund update the same package; a later purchase is linked as a renewal).

To enable (all require you or an admin): apply the migrations; create and link packages in the Hub; set server env
`WOOCOMMERCE_WEBHOOK_SECRET` and `SUPABASE_SERVICE_ROLE_KEY`; in WooCommerce > Settings > Advanced > Webhooks add
*Order created* and *Order updated* webhooks pointing at the deployed URL using the same secret. Students must sign up with
the same email they use at checkout (otherwise WooCommerce shows a failed delivery and retries).

> **Price note (October 30, owner correction).** An October 30 message described a 65-minute lesson at $60. That was a mistake and is **withdrawn**:
> the lesson is **60 minutes**, and the single 60-minute lesson is **$65**. The Hub supports 45- and 60-minute lessons only (65 was never kept).
> **Confirmed (latest owner message):** single lesson = **60 minutes for $65**. **Recommended** monthly (four 60-min lessons) **$248** and 12-week
> **$720 = three payments of $240**, *pending final business approval*. The $232 / $690 figures are withdrawn. The Hub stores no prices
> (WooCommerce owns them), so nothing in the software depends on this choice, and no store price has been changed.

### Packages are configured in the Hub (staff > Voice > Packages)
Each package defines: lesson count, lesson length (45 or 60), expiry, a library access level, whether it includes a personalized
development plan, how many assessments and recording-feedback reviews it includes, and which store product IDs sell it.
Entitlements are copied onto each purchase, so editing a package never changes what a student already bought. Nothing is
seeded; products map to nothing until you link them, and unlinked products grant nothing.

Finalized prices (owner, October 29) and the proposed entitlement for each. Prices live only in WooCommerce:
| Package | Price | Entitlement to configure |
|---|---|---|
| Single lesson, 45 min | $45 | 1 x 45 |
| Single lesson, 60 min | $65 | 1 x 60 |
| Monthly, four weekly lessons, 45 min | $172 | 4 x 45, one-time purchase, no auto-renewal |
| Monthly, four weekly lessons, 60 min | $248 | 4 x 60, one-time purchase, no auto-renewal |
| 12-week coaching, twelve weekly lessons, 45 min | $504 (3 x $168) | 12 x 45 |
| 12-week coaching, twelve weekly lessons, 60 min | $720 (3 x $240) | 12 x 60 |
| Annual coaching | future only | not configured |
| 3-lesson and 6-lesson bundles | discontinued | not configured |

**What the live store shows today versus the finalized prices above (read-only audit on October 29; nothing in the store was changed).**
The finalized 12-week 60-minute plan is $720 total, which is **three payments of $240**. The store currently lists it differently:

| Item | Store today | Finalized | Action for the store owner |
|---|---|---|---|
| 60-min single lesson (1793) | $70 | $65 | change price |
| Monthly, four 60-min lessons (1786) | $252 | $248 | change price |
| 12-week 60-min, paid in full (1788) | $744 | $720 | change price |
| 12-week 60-min, 3 payments (1847) | $248 per payment | $240 per payment | change price |
| 12-week 45-min, 3 payments (1846) / paid in full (1787) | $168 / $504 | $168 / $504 | matches |
| 3-lesson bundle (1707, published), 6-lesson bundle (1709, private) | exist | discontinued | unpublish or delete |
| Annual coaching (1789, 1790, private) | exist | future only | leave private |
| Vocal Intensive, 90 min (1794) | exists | not in the finalized list | decide; the Hub supports 45/60-minute lessons only |

Any "$248 per payment" for the 12-week 60-minute plan elsewhere in these notes is the store's current (wrong) value, not the target.
Store product IDs for the finalized packages: 1705, 1793, 1785, 1786, 1787/1846 (12-week 45), 1788/1847 (12-week 60).

### The installment rule (approved October 29, built and tested)
A first installment never grants the whole package. With more than one payment, lessons unlock in proportion to payments received:
12 lessons over 3 payments = **4 after payment 1, 8 after payment 2, all 12 after payment 3** (approved by the owner). A refunded
installment takes its lessons back out of the unlocked balance. Quantity above 1 on an installment product is refused rather than guessed.
Finalized prices: 12-week 45-minute **$504 = 3 x $168**; 12-week 60-minute **$720 = 3 x $240**. The store has not been changed.

**Scheduling is separate from payment.** The instructor can schedule appointments across the whole 12-week program at any time ("Schedule
through 12 weeks"). What payment controls is whether a lesson can be *recorded as taught* (or charged as a late cancellation or missed lesson):
the database refuses that unless a paid, unlocked lesson covers it. The instructor can waive payment for a specific lesson only by entering a
reason, which is stored with the lesson. The command center shows, per student, how many scheduled lessons run beyond their paid lessons and
the date of the first one, so a payment can be chased before that lesson.

**Curriculum access follows payments, content only.** A lesson can be tagged with a package level and/or a number of paid lessons that must be
unlocked ("Open lessons in order" sets lesson 1 after one paid lesson, lesson 2 after two, and so on). The rule closes the lesson's teaching
content and files, not the lesson itself. If a refund closes content, the student keeps the lesson title and all records.

**A refund restricts access and deletes nothing.** Completed lessons (with the package they were charged to), assignments, submissions,
recordings, shared feedback, progress and instructor notes (private notes stay private) are untouched. This is tested.

### Matching installment payments to their own purchase
Options considered: (1) always give a payment to the earliest unpaid plan (simple, but wrong whenever a student has two plans); (2) require
the store to send a reference to the first order (exact, needs store configuration); (3) never guess, and queue anything unclear for a person.
**Implemented: (2) with (3) as the safety net**, plus an opt-in shortcut:
1. If the order carries a reference, it goes to exactly that purchase. The reference is the order meta `dove_plan_order` (the first
   order's number) or, if the store creates later installments as child orders, the order's parent order. A reference that does not belong to
   that student, or whose first order is not recorded yet, is never matched (the store retries the delivery).
2. No reference and no open plan for that student and package: it starts a new purchase.
3. No reference and an open plan: the payment waits in **Store payments waiting to be matched** in the command center. You choose "start a new
   plan" or the exact plan. Nothing is lost and nothing is guessed.
4. Optional per package: "match payments with no reference to the student's single open plan". Off by default; use it only if the store cannot send a
   reference. Even then, a student with two open plans always goes to the waiting list.

**Store configuration still needed (not done):** make installments 2 and 3 carry the first order's number in order meta `dove_plan_order`
(or create them as child orders of the first). How the installment orders are created in WooCommerce was not visible to me, so this has to be
confirmed against the real store; until then payments without a reference queue for a person to match.

### Payment-first, then booking (needs a WordPress change; not done)
Because the pages are public iframes, "pay first" is not enforced today. Options, in order of effort: (1) after checkout,
redirect to the booking page and remove the public links (honor system); (2) make `/book-45/` and `/book-60/` visible only to
logged-in customers who bought a vocal product (needs a WordPress membership or visibility rule); (3) recommended for
recurring students: skip public booking and let the Hub generate their slot. No WordPress pages were modified.

## Consultation automation (built, not deployed)
See `integrations/consultation/README.md`. Needs a Google owner to install the script on the form's response sheet,
set the calendar ID, and (for info@doveexpressions.org) own the script or configure a verified send-as alias.
Form ID, sheet ID and calendar ID were not available and were not invented. The Hub table `dp_consultation_inquiries` and the
command center list are ready; a sync from the sheet is not built (options: manual entry, or a small authenticated endpoint
once the sheet exists).

## Policy alignment
The site's policy page requires 24 hours' notice to reschedule. The command center offers "Cancelled in advance" (no credit
used) versus "Late cancel" and "Missed" (credit used). Confirm this matches the written policy before relying on it.


## Testimonials: consent, publication, website display and withdrawal
A testimonial is private by default. It is shown publicly only when the student ticked the separate public-use permission, an administrator
approved it, an administrator marked it published, and the student has not withdrawn. Students can withdraw public permission or delete a
testimonial from their Voice home; withdrawal unpublishes at once, keeps the private record, stops new video links, and staff cannot republish it.

**Public page (unlisted):** `/testimonials` is not linked from the app and tells search engines not to index it. First name only.

**Website display (when you are ready).** Two live sources, both read from the database on every request, never cached, so a withdrawal removes the
review from the website the next time it loads:
- *Embed (recommended):* put an iframe on a WordPress page: `<iframe src="https://YOUR-HUB-DOMAIN/testimonials/embed" title="Student voices" width="100%" height="900" style="border:0"></iframe>`.
  Only doveexpressions.org and www.doveexpressions.org may frame it (set `TESTIMONIAL_EMBED_ORIGINS` to change the list).
- *JSON feed:* `GET https://YOUR-HUB-DOMAIN/api/testimonials` returns `{ testimonials: [{ id, name, text, videoUrl }] }` with `Cache-Control: no-store`
  and CORS limited to the same website origins. Fetch it in the browser at page load; do not store it.

**Limits that withdrawal cannot reach (important):** (1) **Never copy a testimonial's text or video into a WordPress post, page, builder template,
newsletter or social post**: a copy is outside the Hub and cannot be withdrawn automatically. (2) A video link already opened can keep playing for up
to 10 minutes. (3) If a caching plugin or a CDN caches the *Hub's* responses, withdrawal is delayed by that cache; the Hub sends no-store headers, so
do not override them. (4) A server-side fetch by WordPress that stores the result would also be a copy. The browser tests check the page, embed and feed
for a signed-out visitor, including after withdrawal.
