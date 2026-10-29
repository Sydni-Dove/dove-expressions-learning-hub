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

### The installment rule (built and tested; confirm the unlock schedule)
A first installment must never grant the whole package. Each package has a **number of payments**. With more than one, lessons
unlock **in proportion to payments received**: for 12 lessons over 3 payments, 4 after the first, 8 after the second, all 12 after
the third. Lessons already taught before a payment arrives are charged to the package once enough are unlocked. A refunded
installment takes its lessons back out of the unlocked balance. Each paid store order line counts as one payment on the student's
open package for that product (a replayed order changes nothing; buying quantity 2 of an installment product is refused rather than
guessed). The student's dashboard says, for example, "Payment 1 of 3 received: 4 of 12 lessons unlocked." Tested end to end through
the webhook route on the local stack. **Confirmed by the owner (October 29):** the store collects each installment as its own separate order. That is how the Hub reads it.
Limit to know: the Hub attaches each paid order for an installment product to that student's earliest plan still waiting for payments,
so if one student bought two 12-week plans at the same time their payments would be applied in order, not matched to a specific plan.
Still to confirm: that proportional unlocking (4, 8, 12) is the schedule you want.

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


## Testimonials: consent, publication and withdrawal
A testimonial is private by default. It is shown publicly only when the student ticked the separate public-use permission, an
administrator approved it, and an administrator then marked it published. The public page is `/testimonials` (first name only, video
served through short-lived links, `noindex` until you decide to promote it; it is not linked from the app, so link or embed it from the
website when you are ready). Students can **withdraw public permission** or **delete** a testimonial from their Voice home: withdrawal
unpublishes at once, keeps the private record, stops new video links being issued, and cannot be reversed by staff (the student would
submit again). A video link already opened can keep playing for up to 10 minutes (the link lifetime). The database enforces all of this;
the browser tests check what a signed-out visitor can and cannot see.
