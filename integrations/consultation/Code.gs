/**
 * Dove Expressions vocal consultation follow-up (Google Apps Script, bound to the
 * spreadsheet that receives the Google Form responses).
 *
 * NOT DEPLOYED. Nothing here has been run against the real form or sheet. Before use, follow
 * integrations/consultation/README.md: set Script Properties, add the status columns, install the
 * two triggers, and test with a throwaway submission.
 *
 * Flow: form submit -> record + acknowledgment with booking link -> hourly check:
 *   booked? mark and stop reminders : 48h without booking? send one reminder.
 * After the consultation: fill "Recommendation" and "Enrollment link", then use the
 * "Dove Expressions" menu to send the recommendation.
 */

// Header text in the Form-response sheet. CONFIRM these against the real form's question titles.
var COLS = { name: 'Name', email: 'Email', phone: 'Phone', interest: 'What are you hoping to work on?' };
// Columns this script adds to the right of the form columns (created automatically if missing).
var STATUS_COLS = ['Status', 'Acknowledged At', 'Reminder Sent At', 'Booked At', 'Consultation Held', 'Recommendation', 'Enrollment Link', 'Recommendation Sent At'];

var BOOKING_URL = 'https://doveexpressions.org/book-consultation/'; // verified live page (Google Calendar appointment schedule)
var REMINDER_AFTER_HOURS = 48;

function cfg_(key) {
  var v = PropertiesService.getScriptProperties().getProperty(key);
  if (!v) throw new Error('Missing Script Property: ' + key);
  return v;
}
// Script Properties to set (never hard-code them here):
//   CONSULT_CALENDAR_ID  the calendar that receives consultation bookings (to detect confirmed bookings)
//   SENDER_ALIAS         optional, e.g. info@doveexpressions.org; must be a verified "Send mail as" alias of the
//                        Google account that owns this script, otherwise mail is sent from that account itself
//   REPLY_TO             optional reply-to address
//   OWNER_NOTIFY         optional address to notify when a prospect books

function sheet_() { return SpreadsheetApp.getActiveSpreadsheet().getSheets()[0]; }

function ensureColumns_(sh) {
  var lastCol = sh.getLastColumn();
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  STATUS_COLS.forEach(function (c) {
    if (headers.indexOf(c) === -1) { lastCol++; sh.getRange(1, lastCol).setValue(c); headers.push(c); }
  });
  return headers;
}

function colIndex_(headers, name) {
  var i = headers.indexOf(name);
  if (i === -1) throw new Error('Column not found: ' + name + '. Update COLS to match the form.');
  return i + 1;
}

function send_(to, subject, body) {
  var opts = { name: 'Dove Expressions' };
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('SENDER_ALIAS')) opts.from = props.getProperty('SENDER_ALIAS');
  if (props.getProperty('REPLY_TO')) opts.replyTo = props.getProperty('REPLY_TO');
  GmailApp.sendEmail(to, subject, body, opts);
}

/** Trigger 1: installable "On form submit" trigger. */
function onFormSubmit(e) {
  var sh = sheet_();
  var headers = ensureColumns_(sh);
  var row = e.range.getRow();
  var get = function (name) { return String(sh.getRange(row, colIndex_(headers, name)).getValue() || '').trim(); };
  var email = get(COLS.email);
  var name = get(COLS.name) || 'there';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    sh.getRange(row, colIndex_(headers, 'Status')).setValue('Needs attention: invalid email');
    return;
  }
  send_(email, 'Thank you for your interest in vocal coaching',
    'Hi ' + name + ',\n\nThank you for reaching out to Dove Expressions. We received your inquiry and are glad you are considering vocal coaching.\n\n' +
    'The next step is a free 20-minute consultation to talk about your goals and the coaching options that fit you best. Choose a time here:\n' +
    BOOKING_URL + '\n\nWe look forward to meeting you.\n\nDove Expressions');
  sh.getRange(row, colIndex_(headers, 'Status')).setValue('Acknowledged');
  sh.getRange(row, colIndex_(headers, 'Acknowledged At')).setValue(new Date());
}

/** Trigger 2: time-driven, every hour. Detects bookings and sends one reminder after 48 hours. */
function checkFollowUps() {
  var sh = sheet_();
  var headers = ensureColumns_(sh);
  var last = sh.getLastRow();
  if (last < 2) return;
  var cal = CalendarApp.getCalendarById(cfg_('CONSULT_CALENDAR_ID'));
  if (!cal) throw new Error('Calendar not found for CONSULT_CALENDAR_ID');
  var now = new Date();
  var c = function (n) { return colIndex_(headers, n); };
  for (var row = 2; row <= last; row++) {
    var status = String(sh.getRange(row, c('Status')).getValue());
    if (status !== 'Acknowledged') continue;                       // only open inquiries
    var email = String(sh.getRange(row, c(COLS.email)).getValue()).trim().toLowerCase();
    var ackAt = sh.getRange(row, c('Acknowledged At')).getValue();
    if (!email || !(ackAt instanceof Date)) continue;
    var from = new Date(ackAt.getTime() - 3600 * 1000), to = new Date(now.getTime() + 60 * 86400000);
    var booked = cal.getEvents(from, to).some(function (ev) { return ev.getGuestByEmail(email) !== null; });
    if (booked) {                                                   // booking confirmed: stop reminders
      sh.getRange(row, c('Status')).setValue('Booked');
      sh.getRange(row, c('Booked At')).setValue(now);
      var notify = PropertiesService.getScriptProperties().getProperty('OWNER_NOTIFY');
      if (notify) GmailApp.sendEmail(notify, 'Consultation booked: ' + email, 'A prospect booked their consultation: ' + email);
      continue;
    }
    var hours = (now.getTime() - ackAt.getTime()) / 3600000;
    if (hours >= REMINDER_AFTER_HOURS && !sh.getRange(row, c('Reminder Sent At')).getValue()) {
      var name = String(sh.getRange(row, c(COLS.name)).getValue()).trim() || 'there';
      send_(email, 'Your vocal consultation is waiting',
        'Hi ' + name + ',\n\nJust a friendly reminder that you can still book your free 20-minute vocal consultation:\n' + BOOKING_URL +
        '\n\nIf you have any questions, simply reply to this email.\n\nDove Expressions');
      sh.getRange(row, c('Reminder Sent At')).setValue(now);
    }
  }
}

/** Menu action: send the post-consultation recommendation to the selected row(s). */
function sendRecommendation() {
  var sh = sheet_();
  var headers = ensureColumns_(sh);
  var c = function (n) { return colIndex_(headers, n); };
  var rows = sh.getActiveRange().getRow();
  var count = sh.getActiveRange().getNumRows();
  for (var row = rows; row < rows + count; row++) {
    if (row < 2) continue;
    var rec = String(sh.getRange(row, c('Recommendation')).getValue()).trim();
    var link = String(sh.getRange(row, c('Enrollment Link')).getValue()).trim();
    var email = String(sh.getRange(row, c(COLS.email)).getValue()).trim();
    if (!rec || !/^https:\/\//.test(link) || !email) { SpreadsheetApp.getUi().alert('Row ' + row + ': add a Recommendation and an https Enrollment Link first.'); continue; }
    if (sh.getRange(row, c('Recommendation Sent At')).getValue()) continue;  // never send twice
    var name = String(sh.getRange(row, c(COLS.name)).getValue()).trim() || 'there';
    send_(email, 'Your vocal coaching recommendation',
      'Hi ' + name + ',\n\nThank you for meeting with us. Based on your goals, here is what we recommend:\n\n' + rec +
      '\n\nWhen you are ready, enroll here:\n' + link + '\n\nDove Expressions');
    sh.getRange(row, c('Recommendation Sent At')).setValue(new Date());
    sh.getRange(row, c('Status')).setValue('Recommendation sent');
  }
}

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Dove Expressions').addItem('Send coaching recommendation to selected row(s)', 'sendRecommendation').addToUi();
}

/** Run once from the editor to install both triggers. */
function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('onFormSubmit').forSpreadsheet(SpreadsheetApp.getActive()).onFormSubmit().create();
  ScriptApp.newTrigger('checkFollowUps').timeBased().everyHours(1).create();
}
