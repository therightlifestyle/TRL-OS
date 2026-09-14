# TRL Lead OS

**The system behind every enquiry.**

TRL Lead OS is The Right Lifestyle’s local-first workspace for organising leads, managing follow-ups, and keeping a clear next action attached to every opportunity. It brings a pipeline, CRM board, operational metrics, and a daily review routine into a lightweight static website.

> **Logged → Owned → Next action** is the operating principle. This is a single-browser workspace, not a hosted CRM service or a secure multi-user application.

## Workspace at a glance

| Area | What it does |
| --- | --- |
| **Pipeline** | Create and edit leads; search and filter records; track status, source, channel, next action, dates, offers, value, priority, and notes. Includes selection, duplication, and export tools. |
| **CRM** | View the same records across seven status columns, review deal values, and see upcoming actions. |
| **Analytics** | Review response-stage conversion, date coverage, overdue and undated records, estimated time saved, and seven-day lead creation activity. |
| **Daily Loop** | Review overdue actions, today’s follow-ups, upcoming actions, and records without dates. |
| **Founder’s Day** | Reference the founder’s working schedule, milestone gates, and first-week targets. |
| **Settings** | Update your local profile and access code, change density, collapse navigation, import/export leads, and reset data. |
| **Local assistant** | Use six role presets—Chief, Sales, Content, Builder, Ops, and Research—with rule-based replies. No AI API or external model is connected. |

## Run locally

Requires **Python 3** to serve the site. No build step, database, or API keys are needed.

```bash
python3 -m http.server 3000 --bind 0.0.0.0
```

Visit `http://localhost:3000` on the machine running the server. In a hosted development environment, use its forwarded preview URL instead.

Alternatively, with Node.js installed:

```bash
npm start
```

The application runs as static HTML, CSS, and JavaScript. Google Fonts is optional; system fonts are used if it cannot load. Hosting the site over HTTP is recommended instead of opening it as a `file://` URL so storage has a consistent origin.

## Getting started

1. **Set up your workspace.** Enter your name, business, contact details, current enquiry workflow, biggest follow-up challenge, and desired outcome. Choose an access code of at least six characters.
2. **Or explore with a demo profile.** This uses the existing `Builder` profile and `TRL-2026` convenience code. It opens the same local workspace; it is not an isolated sandbox.
3. **Add a lead.** A name, next action, and next-action date are required. Add business, source, channel, offer, and notes as needed.
4. **Explore the views.** Pipeline and CRM use the same lead collection, not separate databases.
5. **Run the daily review.** Prioritise overdue work, review today’s follow-ups, plan upcoming actions, and give undated records a next step.
6. **Back up your leads.** Export JSON regularly, especially before clearing browser data or resetting the workspace.

“Load sample leads” adds up to 20 placeholder records (`— Row 1` through `— Row 20`), preserving existing leads and skipping matching placeholder names. Replace these with real, non-sensitive prospect details when ready.

## Operating context from the website

### Pipeline conventions

The seven stages are:

```text
not contacted → message sent → replied → call booked → proposal sent
                                                        ├─ closed-won
                                                        └─ closed-lost
```

The page includes warm local-business, creator, and existing-contact source options, with broader warm, cold, referral, and inbound conventions described in Settings. Source options vary between the existing controls; Settings is a reference, not a source/stage editor.

The website’s offer examples are **Micro Audit ($35)**, **Automation Sprint ($499)**, and **Founder OS ($1,297)**. These are planning values in the interface, not a checkout or payment integration. PKR figures use a fixed **280 PKR per USD** approximation, not a live exchange rate. Some summary views use different fallback valuation rules, so values should be treated as planning estimates rather than accounting totals.

### Daily cadence

The founder’s reference working window is **14:00–04:00 PKT**:

| Time (PKT) | Focus |
| --- | --- |
| 14:00 | Ten-minute Daily Loop |
| 14:15–15:45 | Outbound conversations |
| 15:45–16:15 | Rest |
| 16:15–18:30 | Delivery window |
| 22:00–04:00 | Deep-work window |

The page’s first-week targets are **20 names, 10 conversations, and 3 audits**. It also contains static milestone references for **27 September** (14-day habit) and **13 October** (first payment). These are existing planning references, not automatically scheduled deadlines. Date calculations follow the browser’s date/time behaviour; the PKT label does not force a timezone conversion.

### Understanding the metrics

- **Conversion:** the share of all leads currently at replied, call booked, proposal sent, or closed-won stages. This is not a win rate.
- **Reliability:** the share of leads with a next-action date; it is date coverage, not uptime or an SLA.
- **Health:** based on overdue open leads and leads without dates. Undated leads are tracked separately, not also counted as overdue.
- **Estimated time saved:** rounded hours based on 15 minutes per lead in the response-stage group. This is a heuristic, not measured productivity.
- **Seven-day activity:** records created on each day, not a complete interaction history.

## Data, backups, and privacy

### Where data lives

Lead records, onboarding answers, profile details, the convenience access code, display preferences, and recent assistant messages are stored in **browser `localStorage`**. The current unlocked session uses **`sessionStorage`**. There is no backend, account service, cloud backup, team synchronisation, or server-enforced access control.

The access code is stored in plaintext and guest access can open the same local data. **It is not a security boundary or encryption.** Do not use this version for sensitive personal, financial, medical, or confidential client information. Do not reuse a real password as the code.

Data is specific to the browser profile and site origin (scheme, hostname, and port). A different deployment URL or preview URL has different storage. Clearing site data, using temporary/private browsing, or changing devices can make the workspace unavailable. Serve the site over HTTPS when deployed; HTTPS does not encrypt its local database at rest.

### Export and import

- **Export JSON:** a lead-array backup with record fields. It does **not** back up your profile, code, settings, or assistant history.
- **Export CSV:** a spreadsheet-friendly subset of lead fields. CSV is not a full-fidelity backup and cannot be imported by this application. Treat spreadsheet cells from untrusted sources as unsafe.
- **Import JSON:** accepts an array and merges records with the same name and source, retaining an existing record ID. Other named records receive new IDs. Only import trusted exports; the existing importer is not a hardened schema validator.
- **Clear all:** removes the local lead collection after confirmation.
- **Reset onboarding:** removes local identity/onboarding state, not the lead collection.
- **Factory reset:** removes workspace data and preferences. Export first; this cannot be undone within the application.

Clipboard-based outreach helpers prepare text; they do not send WhatsApp messages. Clipboard permissions and a secure browser context may be required. No email delivery, automated notifications, scheduling integration, or payment processing is configured.

## Project structure

```text
index.html                 Existing views, workflow logic, and base styles
assets/professional.css    Responsive visual system and density styles
assets/workspace.js        Dynamic labels, local-data notice, keyboard enhancements
tests/workspace.test.cjs   DOM-based workflow regression tests
package.json               Local server and test commands
```

There is deliberately no framework migration in this update. Existing storage keys (`trl-lead-os-v1`, `trl-lead-os-auth`, `trl-onboarding`, and related `trl-*` preferences) remain compatible.

## Development and verification

Requires **Node.js 20 or later** for the test tooling:

```bash
npm ci
npm test
```

The tests execute the page in jsdom and check onboarding disclosures and labels, all six views, sample data, search, density persistence, lead validation/creation/editing, JSON export, and overdue/no-date accounting. jsdom does not verify rendered layout, real downloads, clipboard permissions, or browser accessibility behaviour.

Before deploying, also manually check:

- Desktop, tablet, and narrow mobile layouts; horizontal scrolling stays within data tables.
- Keyboard navigation, visible focus, skip link, mobile drawer, forms, and assistant dismissal.
- Full onboarding and returning-user access, then reload for persistence.
- JSON export/import round-trip using disposable data and a downloaded-file inspection.
- Destructive-action cancellation and confirmation in a disposable browser profile.

## Deploy

Upload **`index.html` and the `assets/` directory together** to any static host. GitHub Pages can serve these files without a build step. Relative asset paths support deployment under a repository subpath. No deployment is created automatically by the local server or test commands.

Before any sensitive or multi-user production use, add real server-side authentication and authorisation, protected persistence, validated imports, a security review, and an appropriate privacy policy. This repository currently provides a local productivity tool, not those production services.

## Brand and contact

**The Right Lifestyle** · TRL Lead OS
Website contact: **officialtrlservice@gmail.com**
Website phone: **0319 0091457**

The workflow descriptions, schedule, offers, and brand details above are drawn from the website in this repository. No license has been declared; repository visibility alone does not grant a reuse license.
