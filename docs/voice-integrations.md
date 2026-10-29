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
`POST /api/webhooks/woocommerce` verifies WooCommerce's HMAC signature, maps products to entitlements, matches the buyer by
billing email to a Hub account, and calls `dp_record_package_purchase` (service role only, idempotent by order and line item;
status changes such as refund update the same package; a later purchase is linked as a renewal).

To enable (all require you or an admin): apply migration `20261029090000`; set server env `WOOCOMMERCE_WEBHOOK_SECRET`,
`SUPABASE_SERVICE_ROLE_KEY`, `WOOCOMMERCE_PACKAGE_MAP`; in WooCommerce > Settings > Advanced > Webhooks add
*Order created* and *Order updated* webhooks pointing at the deployed URL using the same secret. Students must sign up with
the same email they use at checkout (otherwise WooCommerce shows a failed delivery and retries).

### Package map needs your confirmation
Unlisted products grant nothing. Proposed entries, inferred from names and prices, **not confirmed**:
| Product (ID) | Price | Proposed entitlement | Question |
|---|---|---|---|
| Private lesson 45 min (1705) | $45 | 1 x 45 | - |
| Private lesson 60 min (1793) | $70 | 1 x 60 | - |
| Monthly, four 45-min (1785) | $172 | 4 x 45 | expiry? |
| Monthly, four 60-min (1786) | $252 | 4 x 60 | expiry? |
| 12-week 45 paid in full (1787) / 60 (1788) | $504 / $744 | 12 lessons | confirm 12 lessons, expiry |
| 12-week 45 / 60, 3 payments (1846 / 1847) | $168 / $248 | 12 lessons | How are the 3 payments collected? The product is "simple" at the per-payment price; the order is not the whole purchase. |
| Annual 45 / 60 (1789 / 1790, private) | $1,920 / $2,880 | 48 lessons? | currently unpublished |
| 3-lesson (1707) / 6-lesson (1709) bundles | $120 / $225 | 3 / 6 lessons | 45 or 60 minutes? Not stated. |
| Vocal Intensive 90 min (1794) | $105 | none | Hub supports 45/60-minute lessons only |
| Demo 30 min (1703), Workshop (1718) | | none | not coaching credits |

Example value: `{"1705":{"minutes":45,"credits":1,"valid_days":null},"1793":{"minutes":60,"credits":1,"valid_days":null}}`

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
