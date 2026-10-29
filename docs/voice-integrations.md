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

**Differences between these prices and the live store (read-only audit on October 29; nothing was changed):**
60-minute single lesson is $70 (should be $65); monthly 60-minute is $252 (should be $248); 12-week 60-minute is $744 / 3 x $248
(should be $720 / 3 x $240); the 3-lesson bundle (ID 1707, published) and 6-lesson bundle (ID 1709, private) still exist; private
annual products (1789, 1790) exist; a 90-minute Vocal Intensive (1794) exists and the Hub only supports 45/60-minute lessons.
Store product IDs for the entries above: 1705, 1793, 1785, 1786, 1787/1846 (12-week 45), 1788/1847 (12-week 60).

**Open question for the 12-week "3 payments" products:** the store sells each as a simple product at the per-payment price
(1846 = $168, 1847 = $248). The Hub grants a package per paid order line, so as the store is configured today a student who pays
once would receive all twelve lessons. Decide when the lessons unlock (all on the first payment, or tied to payment 1/2/3)
before enabling the webhook.

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
