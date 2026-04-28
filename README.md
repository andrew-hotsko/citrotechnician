# CitroTechnician

Internal field-ops tool for **CitroTech Corporation**. Replaces spreadsheets,
text threads, and paper checklists for the post-sale lifecycle — from the moment
a deal closes through recurring annual maintenance of wildfire defense
applications (MFB-31, MFB-34, MFB-35-FM).

**Primary users:** Office / Ops Manager (desktop), COO (desktop), 3 field
technicians (mobile).

---

## Stack

| Layer | Tool |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui (Base UI primitives) |
| Database | Supabase (PostgreSQL) |
| ORM | Prisma 7 with `@prisma/adapter-pg` |
| Auth | Supabase Auth (Google OAuth provider) |
| Storage | Supabase Storage |
| Hosting | Vercel |
| Maps | Google Maps JavaScript API *(Phase 3)* |
| PDF | `@react-pdf/renderer` *(Phase 5)* |
| Salesforce | `jsforce` read-only *(Phase 7)* |
| Realtime | Supabase Realtime *(Phase 3+)* |
| Background jobs | Vercel Cron + Inngest *(Phase 6)* |

---

## Quick start

```bash
cp .env.example .env.local
# fill in Supabase credentials — see SETUP.md
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Open http://localhost:3000. See [SETUP.md](./SETUP.md) for the full setup guide
including Google OAuth configuration.

---

## Project structure

```
prisma/
  schema.prisma           # data model
  seed.ts                 # 3 techs, 3 checklist templates, 18 sample jobs

src/
  app/
    login/                # public login page
    auth/callback/        # OAuth callback route
    (app)/                # authenticated route group
      dashboard/
      # pipeline, map, calendar, jobs, ... (Phase 2+)
    page.tsx              # redirect → /dashboard
    layout.tsx            # root HTML layout
  components/
    top-nav.tsx           # horizontal app nav
    slide-over.tsx        # right-side drawer primitive
    user-menu.tsx         # avatar dropdown / sign out
    ui/                   # shadcn primitives
  lib/
    auth.ts               # getCurrentUser() — syncs Supabase user → Prisma
    prisma.ts             # Prisma singleton (pg driver adapter)
    supabase/             # browser + server + middleware clients
    utils.ts              # cn()
  middleware.ts           # session refresh + redirect unauth → /login
  generated/prisma/       # generated client (gitignored)
```

---

## Build phases

- ✅ **Phase 1 — Foundation**: scaffold, schema, auth, base layout, seed data
- ✅ **Phase 2 — Core data**: `/jobs`, `/pipeline` with dnd-kit Kanban, job
  detail slide-over
- ✅ **Phase 3 — Tech mobile**: role-gated `/tech` flow with checklist, photos,
  signature, PDF service report on completion
- ✅ **Phase 4 — Map + Calendar**: Google Maps with clustering + trip planner,
  tech swim-lane calendar with drag-to-schedule
- ✅ **Phase 5 — Dashboard + Import**: dashboard widgets (stats, needs-attention,
  tech workload, upcoming week, activity feed) + CSV import with geocoding
- ✅ **Phase 6 — Maintenance engine**: auto-spawn child cycles on completion,
  Vercel Cron at 9am daily, T-90/60/30/overdue reminders, task inbox
- ✅ **Phase 7 — Salesforce sync**: `jsforce` one-way nightly pull, manual
  "Sync now," sync history with per-row error reporting

See [SPEC.md](./SPEC.md) for the original product brief and
[briefing/index.html](./briefing/index.html) for the team handoff doc.

---

## Related docs

- [briefing/index.html](./briefing/index.html) — single-page team briefing
  (open in a browser; print-friendly for PDF handouts)
- [SPEC.md](./SPEC.md) — full product specification
- [SETUP.md](./SETUP.md) — first-time setup (Supabase, Google OAuth)
