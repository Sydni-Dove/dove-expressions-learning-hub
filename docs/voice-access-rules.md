# Voice onboarding and payment-access rules

Status: implemented and tested locally. **Not deployed. Migration `20261101090000` is NOT applied to the hosted project.** Every rule below is enforced by the database (policies, triggers, functions); the screens only explain what the database already allows.

## The confirmed business decision
**Before payment:** consultation, **Vocal Demo**, post-consultation **intake** (Hub form or Google Forms import).
**After verified payment:** specialized assessments the instructor chooses, recorded demonstrations and homework recordings, coaching resources, new assigned practice, and the plan being approved for the student.

## What "verified paid access" means (`dp_private.voice_paid`)
All of these must be true:
1. A Voice coaching package exists for the student from a **WooCommerce order attributed to them** (`source = 'woocommerce'`). Attribution is the existing reference-based matching; an unclear payment waits in the unmatched queue for a person and unlocks nothing until matched to the right purchase.
2. At least **one installment is actually paid** (`installments_paid >= 1`, status `partial` or `paid`). Pending, failed and refunded do not count.
3. The package is **not expired**.

Not counted (fail closed): instructor-created **manual** packages, **complimentary** packages, and a payment for a different student. See "Decisions for you".

Separately, using Voice features also needs **enrollment** (`voice_member`) except for intake (below). Payment alone never enrolls anyone.

## Rule by rule
| # | Rule | How it is enforced |
|---|---|---|
| 1 | Consultation and intake need no paid package; intake may start in Google Forms | `dp_voice_prospects` (instructor invites a person who has an account after the consultation) + `dp_private.intake_ok` = enrolled **or** invited. `dp_voice_submit_intake`, `dp_voice_import_intake`, and the read policies on intakes and profiles use `intake_ok`, not payment. The CSV import preview/mapping/dedupe is unchanged. |
| 2 | Intake never unlocks assessments, lessons or resources | Intake writes only intake rows and the student's *choice* of optional tracks. It creates no enrollment and no package. Resources, library, goals, assessments, recordings and practice all test `voice_paid` separately. |
| 3 | Payment makes the student *eligible*; it assigns nothing | Webhook/purchase creates a package only. No code creates assessments. |
| 4 | Assessments A/B/C and recorded demonstrations need verified payment | Trigger `dp_voice_assessment_gate` (insert: paid + package allowance + prophetic rule; student save/submit: still paid). Trigger `dp_practice_recording_gate` (new recording and new submission need paid). |
| 5 | Prophetic assessments need the student's selection **and** instructor authorization | Same trigger: `prophetic_worship` must be in both `selected_tracks` and `approved_tracks`. Assessment A stays unassignable until its source text exists. |
| 6 | Never "assign everything" | Each assignment is one assessment, chosen by the instructor, **with a written reason** (`assign_reason`, shown to the student), within the package's `assessments_included` allowance. A package with 0 included allows none. |
| 7 | Instructor approves the plan before the student sees it | Drafts are staff-only; `dp_plan_activate` (and later revisions) also need the student to be paid (`dp_voice_plan_payment_gate`). Copies from the sample cannot be approved until reviewed. |
| 8 | New assignments and recordings follow payment; completed work is preserved | Trigger `dp_voice_practice_assignment_gate` on new practice assignments (weekly plans, plan lessons, recording follow-ups). Existing assessments, answers, recordings, feedback, plans, progress checks and instructor notes are never deleted or hidden from the student by a refund or expiry. |
| 9 | Database-level, not UI | All of the above are triggers/policies/functions; `tests/sql/voice-access.test.ts` and `voice-enforcement.test.ts` try the forbidden paths directly. |

## The Vocal Demo is the technical baseline (no separate technical assessment)
- The Vocal Demo happens at the consultation, **before payment**. The instructor records ratings (1–5) for the skills heard (pitch, range, breath, tone, agility and the other core areas), strengths, focus and private notes (`dp_voice_record_demo`). It is append-only: the latest entry is the baseline and earlier ones stay as history. It needs no payment, enrolls no one and unlocks nothing; the student sees it only if the instructor shares it.
- There is **no technical-assessment kind** after purchase. After payment only **specialized** assessments are assigned (Personal Time With God, Creative Vocal Expression, and How Does God Speak to You? once its source exists), each chosen for the student's interests and goals.
- The personalized plan combines **Vocal Demo + intake + any specialized assessments** (+ approved optional tracks). The plan draft starts from the demo's ratings; instructor observations override them.
- Progress checks and reassessment are unchanged. **Baseline in every comparison is the Vocal Demo** unless the instructor enters an explicit baseline check, so the baseline is never collected twice.

## Screens
Student: `/voice/intake` (enrolled or invited), then notices on `/voice/assessments`, `/voice/recordings`, `/voice/resources`, `/voice/plan` explaining that those open after payment is confirmed (existing records stay visible). Instructor: `/staff/voice/development` shows each person as *Invited for intake / Enrolled* and *paid access verified / no verified payment*, invite form, Vocal Demo form, assessment assignment (disabled with the reason when unpaid or not enrolled).

## Decisions for you
1. **Offline or complimentary payments.** Only WooCommerce-verified packages unlock paid features. If you also take payment another way (cash, Square) or give complimentary access, those students are *not* eligible today. Options: record the payment through the store, or add an explicit instructor "verified offline payment" action later.
2. **`assessments_included`.** Assessments need the purchased package to include them. Existing tiers default to **0**, so no one can be assigned an assessment until you set this number on each package (staff > Voice > Packages).
3. **Refund/expiry and the plan.** Students keep seeing their plan, answers and feedback after a refund or expiry, but no new practice, recordings or assessments. If you would rather hide the plan too, say so.
4. **Enrollment.** Payment does not enroll a student; you still enroll them. If you want enrollment to happen automatically on verified payment, that is a separate, small change.

## Tests (all local)
SQL: `tests/sql/voice-access.test.ts` (unpaid intake, intake unlocks nothing, unpaid assessment denial, payment unlocking, wrong attribution and unmatched payments, installments, refunds, expiry, existing records, prophetic gating, Vocal Demo) plus the updated `voice-enforcement`, `voice-development`, `voice-recordings`, `voice-revisions`, `rollback`. Browser: `tests/e2e-auth/access.spec.ts` (prospect intake, demo, unpaid locks, payment unlock, refund, demo-as-baseline).
