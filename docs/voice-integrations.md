# Voice integrations: payment, booking, consultation

Audited October 29, 2026 against the live WordPress site (read-only) and this repository. **Pricing revised October 30, 2026: the 60-minute
offering was replaced by a 65-minute lesson** (see "Revised pricing" below).

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

### Packages are configured in the Hub (staff > Voice > Packages)
Each package defines: lesson count, lesson length (**45 or 65 minutes**), expiry, a library access level, whether it includes a personalized
development plan, how many assessments and recording-feedback reviews it includes, how many store payments it has, and which store product IDs
sell it. Entitlements are copied onto each purchase, so editing a package never changes what a student already bought. Nothing is seeded;
products map to nothing until you link them, and unlinked products grant nothing. Prices live only in WooCommerce; the Hub stores no prices.

### Revised pricing (owner, October 30, 2026), final
| Package | Price | Payments | Entitlement to configure |
|---|---|---|---|
| Single lesson, 45 min | $45 | 1 | 1 x 45 |
| Single lesson, 65 min | $60 | 1 | 1 x 65 |
| Monthly, four 45-min lessons | $172 | 1 (one-time, no auto-renewal) | 4 x 45 |
| Monthly, four 65-min lessons | $232 | 1 (one-time, no auto-renewal) | 4 x 65 |
| 12-week coaching, twelve 45-min lessons | $504 | 3 x $168 | 12 x 45, 3 payments (unlocks 4, 8, 12) |
| 12-week coaching, twelve 65-min lessons | $690 | 3 x $230 | 12 x 65, 3 payments (unlocks 4, 8, 12) |
| Annual coaching | future only | | not configured |
| 3-lesson and 6-lesson bundles | discontinued | | not configured |

**What changed on October 30** (relative to the October 29 decision; none of the October 29 prices was ever live in the store or recorded in the Hub):
| Offering | October 29 | October 30 |
|---|---|---|
| Single lesson | 60 min, $65 | **65 min, $60** |
| Monthly, four lessons | 60 min, $248 | **65 min, $232** |
| 12-week, twelve lessons | 60 min, $720 (3 x $240) | **65 min, $690 (3 x $230)** |
| Everything at 45 minutes | $45, $172, $504 (3 x $168) | unchanged |

**Existing purchases and agreements are not changed.**
- *In the Hub:* nothing exists to change. The migrations have not been applied to the hosted project, no package, schedule or lesson has been
  recorded there, and no tier is seeded.
- *If a 60-minute purchase is recorded later* (for example from an order placed before this change): 60 minutes remains a valid stored length, so it keeps
  its lessons, expiry, payments and 60-minute lessons exactly as sold. The app no longer offers 60 for new packages or schedules, and lessons and credits
  match on exact length, so a 65-minute lesson never draws on a 60-minute purchase or the reverse. Purchases are copied at the time of sale; editing a package
  (even its length) never alters purchases already made. This is covered by database tests.
- *In the store:* historical orders are untouched. **Students already part-way through a 60-minute 12-week plan** (payments still due on product 1847 at its old
  per-payment price) keep that agreement: when the webhook is enabled, keep a Hub package named "12-week, 60-minute (earlier offering)" active and linked to
  the old product ID until their payments finish. Do not retire it early, because a retired package stops mapping that product (a store product can be linked
  to only one active package). The same applies to any other old 60-minute product with an open payment plan.
- *Not built:* converting existing 60-minute lessons into 65-minute lessons. That would be a change to a student's agreement and needs your decision case by case.

**What the live store shows today versus the revised prices (read-only audit on October 29; nothing in the store was changed).** The 65-minute products do not
exist yet, so new products (or edits to the old ones, which would change their price for new buyers only) are a store-owner action:
| Item | Store today | Revised | Action for the store owner |
|---|---|---|---|
| Single 45-min (1705) | $45 | $45 | matches |
| Single 60-min (1793) | $70 | replaced by single 65-min, $60 | create a 65-minute product; keep 1793 only while old purchases need it |
| Monthly four 45-min (1785) | $172 | $172 | matches |
| Monthly four 60-min (1786) | $252 | replaced by monthly four 65-min, $232 | create a 65-minute product |
| 12-week 45-min, paid in full (1787) / 3 payments (1846) | $504 / $168 per payment | $504 / $168 | matches |
| 12-week 60-min, paid in full (1788) / 3 payments (1847) | $744 / $248 per payment | replaced by 12-week 65-min, $690 / 3 x $230 | create 65-minute products; keep 1847 mapped while old plans finish |
| 3-lesson bundle (1707, published), 6-lesson bundle (1709, private) | exist | discontinued | unpublish or delete |
| Annual coaching (1789, 1790, private) | exist | future only | leave private |
| Vocal Intensive, 90 min (1794) | exists | not in the revised list | decide; the Hub supports 45- and 65-minute lessons (plus earlier 60) only |

Store product IDs for the 45-minute offering: 1705, 1785, 1787/1846. The 65-minute products have no IDs until the store owner creates them.

### The installment rule (approved October 29, built and tested)
A first installment never grants the whole package. With more than one payment, lessons unlock in proportion to payments received:
12 lessons over 3 payments = **4 after payment 1, 8 after payment 2, all 12 after payment 3** (approved by the owner). A refunded
installment takes its lessons back out of the unlocked balance. Quantity above 1 on an installment product is refused rather than guessed.
Revised prices: 12-week 45-minute **$504 = 3 x $168**; 12-week 65-minute **$690 = 3 x $230**. The store has not been changed. The unlock rule is the same for both.

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
redirect to the booking page and remove the public links (honor system); (2) make `/book-45/` and the 65-minute booking page visible only to
logged-in customers who bought a vocal product (needs a WordPress membership or visibility rule); (3) recommended for
recurring students: skip public booking and let the Hub generate their slot. No WordPress pages were modified.

**65-minute booking:** the live `/book-60/` page ("Schedule Your 60-Minute Lesson") is a Google Calendar appointment schedule set to 60 minutes. There is no
65-minute page or schedule yet; creating one (a new appointment schedule and page) is a store-owner action. Until then the student dashboard sends a
65-minute student who needs to renew to "Message your instructor"; set `NEXT_PUBLIC_BOOKING_URL_65` to the real page address once it exists.

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
