# Worship Development Teaching Editor

Everything below is on the PR #3 development branch only. No migration has been applied to the hosted database, and nothing is merged or deployed.

## What you can edit in the Learning Hub
Open **Voice command center → Worship Development** (`/staff/voice/worship`), then a teaching. Each teaching has six tabs:

| Tab | What it holds |
|---|---|
| **Student lesson** | Title, short description, session length, learning objectives, and the lesson itself as a list of sections. |
| **Instructor notes** | Your private script, Scripture explanations, timing, examples and illustrations, facilitation notes and reminders. Never published and never visible to students. |
| **Details** | Categories (a teaching can sit in several without being copied) and where it started from. |
| **Preview** | Exactly what a student sees (the same page component the student uses). Instructor notes are not included. |
| **History** | Earlier versions with one-click restore. |
| **Assign** | Assign the published teaching to a student and customize it. |

Sections are the building blocks: **Teaching, Scripture reading, Activity, Discussion questions, Reflection, Homework / practice, Media, Part heading** for students; **Teaching script, Teaching, Scripture, Timing, Example, Facilitation notes, Reminder, Media, Part heading** for instructor notes. Each section has a heading, a word-processor style editor (bold, italic, underline, headings, bullet and numbered lists, quotes, links, undo and redo) and optional media (YouTube or Vimeo videos, audio files, documents and links, all `https://`). You can **add, duplicate, move up or down, and delete** sections. Sections start collapsed except the first, so long teachings stay easy to scan on a phone.

**Saving:** changes autosave about a second after you stop typing. The bar at the top always says one of *Unsaved changes*, *Saving…*, *All changes saved 10:42 AM*, or an error. **Save now** (or Cmd/Ctrl+S) saves immediately, and the browser warns you if you try to leave with unsaved changes. If you edit the same teaching in two windows, the older window is refused and offers to reload rather than overwrite your newer work. Opening or viewing a teaching never changes it.

## Creating a new teaching
**New teaching** at the top of the list: give it a title, optionally start from a template (**Bible teaching, Vocal exercise lesson, Worship leadership development, Practical coaching lesson, Scripture-to-song activity**) or a blank page, and tick its categories. Templates only create empty, titled sections you then fill in, rename, move or delete; they are optional and carry no preset wording. The new teaching is a **Draft**.

Categories: Vocal Technique, Worship Leadership, Creative Worship Expression, Prophetic Worship Development, Spiritual Foundations, Personal and Ministry Development. A teaching in two categories appears under both but is one teaching.

## Draft, review and publish
| Status | Meaning |
|---|---|
| **Draft** | Editable; not available to students. |
| **Ready for review** | Completed and waiting for your approval; not available to students. Editing it sends it back to Draft so approval always applies to what you actually read. |
| **Published** | Approved; can be assigned. Editing a published teaching keeps it Published and shows **Unpublished changes**; students see nothing new until you choose **Publish update**. |
| **Archived** | Cannot be assigned or edited; students who already have it keep it. Unarchive returns it to Published (or Draft). |

Publishing is always an explicit button followed by a confirmation, and only **faculty or an administrator** can approve, publish or archive. Anyone with Voice editing access can edit and mark ready. Publishing makes an **immutable snapshot of the student lesson only** (instructor notes are never copied into it) and numbers it (Version 1, 2, …). An empty student section blocks publishing until you fill it in or delete it.

**History:** every status change, every named version (**Save a named version**) and an automatic snapshot at most every ten minutes are kept. **Restore this version** copies it into your draft after first saving your current text, so a restore can itself be undone. Published versions are never altered by a restore.

## Assigning, and what students keep
On the **Assign** tab (published teachings only) choose an enrolled, verified-paid student, then optionally set a due date, personal instructions, reflection questions, homework steps (both pre-filled from the teaching and fully editable) and supporting resources. A student never receives a teaching automatically, a teaching can be assigned to a student only once, and the existing payment rules apply unchanged.

The assignment is **pinned to the exact published version** the student was given and shows "Version N". If you later edit or publish an update, that student keeps what they received and all of their submissions and your feedback stay as they were; new assignments receive the newest published version. Responses flow into the normal review queue under Assignments. Refunds and expiry follow the existing rules: students keep what they were assigned, and new assignments are blocked.

## Content safety
Lessons are stored as structured rich-text JSON, never as HTML. The database accepts only a fixed set of node types (paragraphs, headings, lists, quotes, line breaks, text) and marks (bold, italic, underline, strike, links to `https`, `http` or `mailto`), and rejects anything else, including scripts, event handlers, `javascript:` and `data:` addresses and non-`https` media. The renderer re-checks content and builds page elements directly, so unsafe markup cannot appear even if bad data were stored. Only YouTube and Vimeo are shown in frames; other media use the browser's own player or a plain link.

## The three original manuscripts
**Praise Is What I Do**, **The Importance of Being in the Word** and **The Psyche of a Praiser** were converted once into editable teachings (student lesson and instructor notes kept apart), with **no text lost** (a test checks every sentence), and filed under Spiritual Foundations (the third also under Personal and Ministry Development). They arrive as **Ready for review**, never published and never assigned. Module 3 keeps "Gifted but Still Growing" with your core statement verbatim, and the leaders' section. After import the database is the only source of truth; the original files in `scripts/teaching-import/` are frozen and the app never reads them.

## Not done / needs approval
- Migrations `20261102090000` and `20261102100000` are unapplied (the earlier module-table version of these files was never applied, so it was rewritten in place). Applying, merging and deploying need your explicit approval.
- Not built: drag-and-drop reordering (up/down buttons instead), direct file upload for media (paste an `https` address; uploads would need a storage decision), a side-by-side diff in History, and moving an existing student to a newer published version.
- The text has not been theologically reviewed by anyone but you; review and approve in the app.
