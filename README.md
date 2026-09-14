# TRL Lead OS

**The system behind every enquiry.**

TRL Lead OS is a local-first workspace for organising leads, managing follow-ups, and keeping a clear next action on every opportunity. It runs as a static website in your browser.

> **Logged → Owned → Next action.** This is a single-browser workspace, not a hosted CRM or a multi-user cloud app.

## Workspace

| Area | What it does |
| --- | --- |
| **Pipeline** | Create and edit leads. Search, filter, and track status, source, next action, and dates. |
| **CRM** | The same records in seven status columns, with deal value and upcoming actions. |
| **Analytics** | Conversion, date coverage, overdue / undated counts, and seven-day activity. |
| **Daily Loop** | Overdue first, then today’s follow-ups, then upcoming, then leads without dates. |
| **Today** | A simple daily operating view and this-week targets. |
| **Automations** | Visual When → If → Then recipes for your leads. No n8n knowledge required. Stored in this browser only. |
| **Settings** | Profile, access code, density, import/export, and reset. |
| **TRL Assistant** | One local helper for the whole workspace. No extra roles, no AI API. |

## Run locally

Requires **Python 3**. No build step, database, or API keys.

```bash
python3 -m http.server 3000 --bind 0.0.0.0
```

Or with Node.js: `npm start`.

Serve over HTTP (not `file://`) so storage has a consistent origin.

## Getting started

1. Answer the setup questions (who you are, how enquiries reach you, what you want first). Choose an access code of at least six characters.
2. You enter the lead operating system. Add a lead: **name, next action, and next date** are required.
3. Run Daily Loop: overdue, then due today, then missing dates.
4. Optional: open Automations and add a ready-made recipe. It stays off until you turn it on.
5. Export JSON regularly. Data lives only in this browser.

## Pipeline stages

```text
not contacted → message sent → replied → call booked → proposal sent
                                                        ├─ closed-won
                                                        └─ closed-lost
```

## Automations

Connect boxes: **When** → **Only if** → **Then**. Recipes update local leads. They do not send WhatsApp, email, or payments.

## TRL Assistant

The ◈ button opens one assistant for pipeline, loop, automations, drafts, analytics, and settings. It is rule-based and local. It does not call an AI model.

## Data and privacy

Leads, profile, access code, assistant history, and Flow recipes are stored in **browser `localStorage`**. The session uses **`sessionStorage`**. There is no backend, cloud backup, or server-side login.

The access code is stored in plaintext. **It is not encryption.** Do not store sensitive personal, financial, medical, or confidential client data here. Do not reuse a real password as the code.

- **Export JSON** backs up leads only.
- **Factory reset** removes local workspace data, including Flow recipes. Export first.

## Project structure

```text
index.html                 Workspace views and core logic
assets/professional.css    Visual system
assets/workspace.js        Labels, local-data notice, keyboard helpers
assets/flow.css            Automation canvas
assets/flow.js             When → If → Then engine
assets/assistant.css       TRL Assistant panel
assets/assistant.js        Local workspace assistant
tests/                     jsdom regression tests
package.json               Local server and test commands
```

## Tests

```bash
npm ci
npm test
```

Requires Node.js 20+. jsdom does not verify layout, downloads, or clipboard permissions.

## Deploy

Upload `index.html` and `assets/` together to any static host.

This repository is a local productivity tool. Before multi-user production use, add real authentication, protected persistence, and a privacy review.
