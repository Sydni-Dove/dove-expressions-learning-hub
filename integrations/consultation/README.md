# Consultation follow-up automation (not yet deployed)

`Code.gs` is a Google Apps Script for the spreadsheet that receives the vocal consultation Google Form responses.
It has **not** been run: no form, sheet, calendar, or mailbox was accessible when it was written, and no IDs or
credentials were invented. Everything below must be done by someone who owns those Google resources.

## What it does
1. On each form submission: validates the email, sends an acknowledgment containing the booking link
   (`https://doveexpressions.org/book-consultation/`), and records status and time in the sheet.
2. Hourly: looks on the consultation calendar for an event that has the prospect as a guest. If found, marks the row
   **Booked** (reminders stop). If not found and 48 hours have passed, sends **one** reminder.
3. After the consultation: you fill **Recommendation** and **Enrollment Link** in the row, then use
   *Dove Expressions → Send coaching recommendation*. It refuses non-HTTPS links and never sends twice.

## What is needed from you
- Open the form's response spreadsheet, **Extensions → Apps Script**, paste `Code.gs`.
- Confirm the `COLS` header names match the real form questions (name, email, phone, goals).
- Script Properties (Project Settings): `CONSULT_CALENDAR_ID` (the calendar that receives consultation bookings, required);
  optional `SENDER_ALIAS`, `REPLY_TO`, `OWNER_NOTIFY`.
- **Sending from info@doveexpressions.org**: either own the script from that Google account, or add the address as a
  verified *Send mail as* alias in that Gmail account and set `SENDER_ALIAS`. Otherwise Google sends from the script owner.
- Run `installTriggers` once and approve the Gmail, Calendar and Sheets permissions.
- Test with a throwaway submission using your own email before announcing the form.

## Limits to know
- Booking detection relies on the prospect using the **same email** on the booking as on the form. A different email
  looks like "not booked" and triggers a reminder; set the Status cell to `Booked` by hand to stop it.
- Google Apps Script mail has daily quotas (about 100/day on a free Gmail account, 1,500/day on Workspace).
- The sheet is the system of record. Inquiries are shown in the Learning Hub command center only if mirrored into
  `dp_consultation_inquiries` (table exists; no automatic sync is built). See `docs/voice-integrations.md`.
