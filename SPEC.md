# CitroTech Jobs — Project Spec

A build brief for Claude Code. Drop this into the project root as `SPEC.md` and reference it throughout the build.

---

## Part 1: Project Context

### What we're building

An internal job management system for CitroTech Corporation. Replaces spreadsheets, text threads, and paper checklists for the post-sale lifecycle — from the moment a deal closes through recurring annual maintenance.

### Why

CitroTech sells citrus-based wildfire defense applications (MFB-31, MFB-34, MFB-35-FM) to residential and commercial properties across California. Every job becomes a multi-year maintenance relationship. We currently have ~60 active maintenance jobs across the next 2 years, with three field technicians executing them.

Today, scheduling happens in spreadsheets and group texts. That doesn't scale. We need:

1. **A pipeline view** so the Ops Manager can see exactly what needs attention — who to contact, who's confirmed, who's on the calendar, who's been serviced.
2. **A map view** so we can cluster nearby jobs and knock out maintenance efficiently (for example, doing all NorCal maintenance in one trip rather than driving up twice).
3. **A scheduling calendar** that assigns jobs to specific technicians on specific days.
4. **A dead-simple technician flow** for the field — checklist, photos, customer signature, done. No training required.
5. **An automated maintenance engine** that knows when each property is due for reapplication and surfaces it before we forget.

### Who uses it

- **Office / Operations Manager** — primary power user. Runs the pipeline, schedules techs, handles customer outreach. Desktop-first.
- **COO (Andrew)** — admin access, reviews dashboards, occasionally schedules.
- **3 Field Technicians** — Mike Rivera, Carlos Mendoza, Dave Thompson. Mobile only. Show up, do the work, close out the job.

### What this is NOT

- Not a CRM (Salesforce stays the customer/contract source of truth).
- Not customer-facing (no customer portal).
- Not for partners (CPPs have their own system).
- Not a general-purpose field service product — this is tuned specifically to CitroTech's product lifecycle.

### Design principles

- **Bare-bones and dead simple.** The Ops Manager should land on a screen and immediately know what to do next. No training videos.
- **Professional, clean, utilitarian.** Think Linear, not Salesforce. Dense but uncluttered. Minimal chrome.
- **Desktop-first for office, mobile-first for field.** The two experiences are intentionally different.
- **Pipeline and map are the spine.** Everything else supports them.
- **Salesforce is the source of truth today, but this app must stand alone.** Every entity has native CRUD. If we migrate off SF later, it's a data move, not a rewrite.

### Scale

- Day one: ~60 jobs, 3 techs, 5 internal users.
- Designed to handle 500+ jobs without re-architecture.

---

## Part 2: Build Brief

### Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + TypeScript |
| Styling | Tailwind CSS |
| Database | Neon (PostgreSQL) |
| ORM | Prisma |
| Auth | Clerk |
| Hosting | Vercel |
| File storage | Vercel Blob |
| Maps | Google Maps JavaScript API |
| PDF | React-PDF (`@react-pdf/renderer`) |
| Salesforce | `jsforce` (read-only for now) |
| UI primitives | Radix UI + custom Tailwind components |
| Icons | `lucide-react` |
| Forms | `react-hook-form` + `zod` |
| Dates | `date-fns` |
| Drag-and-drop | `@dnd-kit/core` |
| Signature capture | `react-signature-canvas` |
| Map clustering | `@googlemaps/markerclusterer` |

Notifications are **in-app only**. No email or SMS dependencies for MVP. The Ops Manager sees reminders as tasks and urgency badges in the UI; outreach to customers happens through existing channels (phone, Gmail) outside the app.

---

### Data Model (Prisma Schema)

```prisma
model User {
  id            String   @id @default(cuid())
  clerkId       String   @unique
  email         String   @unique
  name          String
  role          Role     @default(VIEWER)
  initials      String?
  color         String?
  phone         String?
  active        Boolean  @default(true)
  createdAt     DateTime @default(now())

  assignedJobs  Job[]    @relation("AssignedTech")
  activityLogs  ActivityLog[]
}

enum Role {
  ADMIN
  OPS_MANAGER
  TECH
  VIEWER
}

model Customer {
  id            String   @id @default(cuid())
  salesforceId  String?  @unique
  name          String
  email         String?
  phone         String?
  notes         String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  properties    Property[]
}

model Property {
  id            String   @id @default(cuid())
  salesforceId  String?  @unique
  customerId    String
  customer      Customer @relation(fields: [customerId], references: [id])

  name          String
  address       String
  city          String
  state         String   @default("CA")
  zip           String?
  latitude      Float
  longitude     Float
  region        Region
  sqft          Int?
  accessNotes   String?
  siteNotes     String?

  jobs          Job[]
  documents     Document[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}

enum Region {
  NORCAL
  SOCAL
  OTHER
}

model Job {
  id              String    @id @default(cuid())
  jobNumber       String    @unique
  salesforceId    String?   @unique

  propertyId      String
  property        Property  @relation(fields: [propertyId], references: [id])

  stage           JobStage  @default(UPCOMING)
  type            JobType   @default(MAINTENANCE)
  product         Product
  sqftTreated     Int
  contractValue   Decimal?

  assignedTechId  String?
  assignedTech    User?     @relation("AssignedTech", fields: [assignedTechId], references: [id])
  scheduledDate   DateTime?
  scheduledStart  String?
  scheduledEnd    String?

  lastServiceDate DateTime?
  dueDate         DateTime
  maintenanceIntervalMonths Int @default(12)

  completedAt     DateTime?
  completedById   String?
  customerSignature String?

  lastContactAt   DateTime?
  contactAttempts Int       @default(0)

  officeNotes     String?
  techNotes       String?
  deferralReason  String?

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  checklistItems  ChecklistItem[]
  photos          Photo[]
  documents       Document[]
  activityLogs    ActivityLog[]
  serviceReport   ServiceReport?
  parentJob       Job?      @relation("MaintenanceChain", fields: [parentJobId], references: [id])
  parentJobId     String?
  childJobs       Job[]     @relation("MaintenanceChain")
}

enum JobStage {
  UPCOMING
  OUTREACH
  CONFIRMED
  SCHEDULED
  IN_PROGRESS
  COMPLETED
  DEFERRED
}

enum JobType {
  INITIAL_APPLICATION
  MAINTENANCE
  ONE_OFF
}

enum Product {
  MFB_31
  MFB_34
  MFB_35_FM
}

model ChecklistItem {
  id            String   @id @default(cuid())
  jobId         String
  job           Job      @relation(fields: [jobId], references: [id], onDelete: Cascade)
  label         String
  order         Int
  completed     Boolean  @default(false)
  completedAt   DateTime?
  completedById String?
}

model Photo {
  id           String   @id @default(cuid())
  jobId        String
  job          Job      @relation(fields: [jobId], references: [id], onDelete: Cascade)
  url          String
  category     PhotoCategory
  caption      String?
  uploadedAt   DateTime @default(now())
  uploadedById String
}

enum PhotoCategory {
  BEFORE
  DURING
  AFTER
  ISSUE
}

model Document {
  id           String    @id @default(cuid())
  jobId        String?
  job          Job?      @relation(fields: [jobId], references: [id])
  propertyId   String?
  property     Property? @relation(fields: [propertyId], references: [id])
  name         String
  url          String
  sizeBytes    Int
  mimeType     String
  uploadedAt   DateTime  @default(now())
  uploadedById String
}

model ServiceReport {
  id          String   @id @default(cuid())
  jobId       String   @unique
  job         Job      @relation(fields: [jobId], references: [id])
  pdfUrl      String
  generatedAt DateTime @default(now())
}

model ActivityLog {
  id          String   @id @default(cuid())
  jobId       String?
  job         Job?     @relation(fields: [jobId], references: [id])
  userId      String?
  user        User?    @relation(fields: [userId], references: [id])
  action      String
  description String
  metadata    Json?
  createdAt   DateTime @default(now())
}

model MaintenanceReminder {
  id           String       @id @default(cuid())
  jobId        String
  type         ReminderType
  scheduledFor DateTime
  triggered    Boolean      @default(false)
  triggeredAt  DateTime?
}

enum ReminderType {
  NINETY_DAY
  SIXTY_DAY
  THIRTY_DAY
  OVERDUE
}

model Task {
  id          String   @id @default(cuid())
  assignedToId String
  jobId       String?
  title       String
  description String?
  dueDate     DateTime?
  completed   Boolean  @default(false)
  completedAt DateTime?
  createdAt   DateTime @default(now())
}
```

---

### Pages & Routes

**Office (desktop)**
```
/                          → redirect to /dashboard
/dashboard                 → Home: stats, needs attention, mini map, tech workload
/pipeline                  → Kanban with 7 stages
/map                       → Full-screen map with filters
/calendar                  → Week view, 3 tech swim lanes
/jobs                      → Searchable table of all jobs
/jobs/[id]                 → Full job detail
/properties                → Property list
/properties/[id]           → Property detail with service history
/customers                 → Customer list
/customers/[id]            → Customer detail
/tasks                     → Ops manager task inbox
/settings                  → Team, integrations
/settings/import           → CSV import
/settings/templates        → Checklist templates per product
```

**Tech (mobile, role-gated)**
```
/tech                      → Today's jobs list
/tech/[jobId]              → Brief + step buttons
/tech/[jobId]/checklist    → Tap-to-check list
/tech/[jobId]/photos       → Before/after photo capture
/tech/[jobId]/signature    → Signature pad
/tech/[jobId]/complete     → Confirmation + PDF
```

**API routes**
```
GET  /api/jobs
POST /api/jobs
GET  /api/jobs/[id]
PATCH /api/jobs/[id]
PATCH /api/jobs/[id]/stage
PATCH /api/jobs/[id]/assign
POST /api/jobs/[id]/complete
POST /api/jobs/[id]/next-maintenance

GET  /api/properties
POST /api/properties
GET  /api/customers
POST /api/customers

POST /api/import/csv
POST /api/salesforce/sync         (cron)
POST /api/reminders/run           (cron, daily)
POST /api/webhooks/clerk
```

---

### Feature Specs

**Dashboard** (`/dashboard`)
- Greeting with user first name
- 4 stat cards: Overdue, Due in 60 days, Scheduled, This week
- Split panel: "Needs attention" list (top 6 by soonest due date) + mini California map
- Tech workload strip: 3 rows with name, scheduled count, horizontal load bar
- Task inbox widget: pending ops-manager tasks (auto-generated reminders)
- Every row click opens the job detail slide-over

**Pipeline** (`/pipeline`)
- Horizontal Kanban: Upcoming / Outreach / Confirmed / Scheduled / In Progress / Completed / Deferred
- Column headers show count and stage name
- Card shows: property name, job number, address, region badge, product code, assigned tech, days-until-due with urgency color
- Top toolbar: region filter, tech filter, search, "New job" button
- **Drag-and-drop between columns** — updates stage, writes ActivityLog entry
- Multi-select with checkboxes for bulk tech assignment

**Map** (`/map`)
- Google Maps centered on California
- Pins colored by status: gray (completed), amber (Y1 due), orange (Y2 due), red (overdue), blue (scheduled), emerald (confirmed)
- Pin clustering at zoom-out via `@googlemaps/markerclusterer`
- Click pin → info card with property summary + "Open job" button
- Left sidebar filters: All / Overdue / Unscheduled / Scheduled / NorCal only / SoCal only
- Tech filter multi-select
- Legend in bottom-left
- Quick-zoom region buttons

**Calendar** (`/calendar`)
- Week view with 3 horizontal swim lanes (one per tech)
- 7 day columns
- Scheduled jobs render as colored blocks in assigned tech's lane
- Top bar: prev/next week, "Today", week label
- Right sidebar: unscheduled jobs sorted by due date — drag into a day cell to schedule
- Click a block → job detail slide-over
- Conflict badge if two jobs on same day for same tech

**Job Detail** (slide-over + `/jobs/[id]`)
- Header: job number, region badge, stage badge, property name, address, action buttons (Schedule / mark in progress / complete)
- Key facts grid: customer, phone, product, sqft, last service, next due, contract value, assigned tech
- Sections: Service history, Pre-job checklist, Documents, Photos, Activity log
- Stage dropdown writes to ActivityLog automatically
- Edit mode for ADMIN/OPS_MANAGER; read-only for VIEWER

**Tech Mobile Flow** (`/tech/*`)
- Role-gated to TECH (ADMIN also allowed for testing)
- Large tap targets (44px min), sunlight-friendly contrast
- **List screen:** today's jobs at top, this week collapsed below
- **Job screen:** brief card, warning banner for notes, 3 step buttons (Checklist / Photos / Signature), "Complete job" button disabled until signature captured
- **Checklist:** tap row to toggle. Items pulled from product template.
- **Photos:** Before (min 2) + After (min 2) grid. Tap empty slot → camera input. Compress to ~1500px longest side. Show upload progress.
- **Signature:** full-width `react-signature-canvas`. Clear / Capture buttons.
- **Complete:** triggers `/api/jobs/[id]/complete` → generates PDF service report via React-PDF → stores in Vercel Blob → creates child maintenance Job → advances stage to COMPLETED → returns to list.

**Maintenance Engine**
- When a job is marked COMPLETED:
  1. Calculate next due date = `completedAt + maintenanceIntervalMonths`
  2. Create child Job (stage UPCOMING, `parentJobId` = current job)
  3. Insert `MaintenanceReminder` records at T-90, T-60, T-30
- Daily cron (`/api/reminders/run`, `0 9 * * *`):
  - For each reminder due today, create a `Task` assigned to the ops manager
  - Auto-advance UPCOMING → OUTREACH at T-60
  - Mark overdue with red urgency (after `dueDate` passes)
- Manual override: any user with OPS_MANAGER+ role can edit `dueDate` or `maintenanceIntervalMonths` per job

**Tasks** (`/tasks`)
- Ops manager inbox — auto-generated reminders land here
- Each task links to its job
- Mark complete after outreach
- Filter by due date, completed/pending

**Salesforce Sync (read-only)**
- Nightly cron (`/api/salesforce/sync`, `0 2 * * *`) via Vercel Cron
- Pulls Closed Won opportunities via `jsforce`
- Creates/updates Customer, Property, Job records matched on `salesforceId`
- Never overwrites locally-edited fields (simple rule: if `updatedAt > lastSyncedAt`, skip)
- Logs outcomes to ActivityLog
- Manual "Sync now" button in Settings

**CSV Import** (`/settings/import`)
- For seeding the 50–60 existing maintenance jobs when we're ready
- Upload → preview table with column mapping UI (auto-match by header name)
- Validate required fields (property name, address, product, last service date)
- Geocode addresses via Google Geocoding API → populate lat/lng
- Bulk insert in a transaction; per-row success/error summary
- Download error CSV for re-upload

**Auth & Roles**
- Clerk for auth, synced to local `User` table via Clerk webhook
- Route-level guards:
  - `/tech/*` → TECH, ADMIN
  - `/settings/*` → ADMIN, OPS_MANAGER
  - Everything else → ADMIN, OPS_MANAGER, VIEWER (VIEWER = read-only)
- TECH users auto-redirect from `/` to `/tech`

---

### Design System

**Visual language:** Linear-style. Minimal, utilitarian, dense but uncluttered.

**Colors**
- Background: `neutral-50` (app), `white` (cards), `neutral-100` (dividers)
- Borders: `neutral-200` default, `neutral-300` hover
- Text: `neutral-900` primary, `neutral-600` secondary, `neutral-400` tertiary
- Primary action: `orange-600` (CitroTech brand — used sparingly, only on primary CTAs)
- Status:
  - Red (`red-500`): overdue, deferred
  - Amber (`amber-500`): Year 1 due, outreach
  - Orange (`orange-500`): Year 2 due
  - Blue (`blue-500`): scheduled
  - Emerald (`emerald-500`): confirmed, completed
  - Violet (`violet-500`): in progress
  - Neutral (`neutral-400`): upcoming

**Typography**
- System font stack (`font-sans`)
- `tracking-tight` on headings
- `tabular-nums` on all numbers
- `font-mono` on job IDs, product codes, timestamps

**Spacing**
- Top nav: 56px
- Card padding: 12–16px
- Type scale: 10px caps labels, 11px meta, 12–13px body, 15px section headers, 20–24px page titles

**Component library to build**
- Primitives: `StageBadge`, `RegionBadge`, `TechAvatar`, `StatCard`, `FilterPill`, `SlideOver`
- Data: `JobCard`, `JobTable`, `ActivityTimeline`
- Views: `KanbanBoard` + `KanbanColumn` (dnd-kit), `MapView` + `MapPin` + `MapFilterSidebar`, `CalendarGrid` + `CalendarEvent`
- Tech mobile: `MobileScreen`, `StepButton`, `SignaturePad`, `PhotoGrid`

---

### Build Sequence

**Phase 1 — Foundation**
- Next.js 15 + TypeScript + Tailwind scaffold
- Prisma schema + Neon connection
- Clerk auth + User sync webhook
- Top nav + SlideOver primitive
- Seed script with 18 sample jobs (use the prototype data)
- **Stop for review before Phase 2**

**Phase 2 — Core Data**
- `/jobs/[id]` detail page + slide-over
- `/pipeline` Kanban with dnd-kit drag-and-drop
- `/jobs` table view

**Phase 3 — Map & Calendar**
- `/map` with Google Maps, filters, pin clustering
- `/calendar` with swim lanes and drag-to-schedule

**Phase 4 — Dashboard & Import**
- `/dashboard` with all widgets
- `/settings/import` CSV flow with column mapping and geocoding

**Phase 5 — Tech Mobile**
- Role-gated `/tech` layout
- Full mobile flow: list → brief → checklist → photos → signature → complete
- PDF service report generation (React-PDF)

**Phase 6 — Maintenance Engine**
- Auto-create child jobs on completion
- Vercel Cron for daily reminders
- Task inbox at `/tasks`
- Auto-stage advancement

**Phase 7 — Salesforce Sync + Polish**
- `jsforce` read-only nightly sync
- Activity log UI refinement
- Deploy to Vercel production

---

### Environment Variables

```bash
DATABASE_URL=

CLERK_SECRET_KEY=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_WEBHOOK_SECRET=

GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=

BLOB_READ_WRITE_TOKEN=

SALESFORCE_CLIENT_ID=
SALESFORCE_CLIENT_SECRET=
SALESFORCE_USERNAME=
SALESFORCE_PASSWORD=
SALESFORCE_SECURITY_TOKEN=

CRON_SECRET=
```

---

### Seed Data

Use the 18 mock jobs from the prototype as initial seed data:

- **NorCal:** Redwood Estates HOA (Folsom), Granite Bay Vineyard, Sierra Ridge Residential (Placerville), Oak Valley Ranch (Auburn), Paradise Pines Community, Tahoe Woodland Estates, Napa Valley Winery, Alamo Hills Residence, Carmel Coast Villa
- **SoCal:** La Jolla Shores Villa, Oceanside Bluffs HOA, Malibu Canyon Estate, Pasadena Hillside Home, Rancho Santa Fe Ranch, Coronado Island Residence, Escondido Vineyard Estate, Laguna Beach Residence, Topanga Ridge HOA

Mix of stages. Three techs: Mike Rivera, Carlos Mendoza, Dave Thompson.

---

### Kickoff Prompt for Claude Code

Paste this as your first message in a fresh Claude Code session:

> Initialize a new Next.js 15 project called `citrotech-jobs` with TypeScript, Tailwind, App Router, Prisma + Neon, and Clerk auth. Use `SPEC.md` in the project root as the source of truth. Start with Phase 1 (Foundation): project setup, Prisma schema from the spec, Clerk integration with the User webhook, base layout with TopNav, SlideOver primitive, and a seed script loading the 18 sample jobs from the spec. Stop after Phase 1 is working and let me review before continuing.
