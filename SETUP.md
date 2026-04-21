# CitroTech Jobs — Setup

One-time setup for running the app locally and provisioning external services.
Phase 1 only requires **Supabase + Microsoft auth**. Google Maps and Salesforce
are added in later phases.

---

## 1. Supabase project

1. Create a new project at https://supabase.com/dashboard.
2. Wait for provisioning (~2 min).
3. Grab credentials from **Project Settings**:
   - **Database → Connection string**
     - Pooled URI (port **6543**) → `DATABASE_URL`
     - Direct URI (port **5432**) → `DIRECT_URL`
   - **API**
     - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
     - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only; never
       commit or expose to the browser — it bypasses RLS)
4. Create a Storage bucket for tech photos and signatures:
   - **Storage → New bucket**
   - Name: `job-media`
   - Public: **yes** (photos are referenced by public URL in service reports)
   - File size limit: 10 MB
   - Allowed MIME types: `image/*`
   - No RLS policies needed for Phase 3 — uploads go through the service role
     key from server actions. Lock this down when the app ever accepts
     browser-direct uploads.

---

## 2. Microsoft (Entra ID) OAuth

Lets CitroTech staff sign in with their `@citrotech.com` Microsoft account.

**In Azure (https://portal.azure.com):**
1. Azure Active Directory (Entra ID) → App registrations → **New registration**.
2. Name: `CitroTech Jobs`.
3. Supported account types: **Accounts in this organizational directory only**
   (single tenant — restricts to CitroTech employees).
4. Redirect URI: `Web` → `https://[project].supabase.co/auth/v1/callback`
   (use your Supabase project URL).
5. Save. Copy the **Application (client) ID** and **Directory (tenant) ID**.
6. Certificates & secrets → **New client secret** → copy the value immediately.

**In Supabase:**
1. Authentication → Providers → **Azure** → toggle on.
2. Paste:
   - Client ID
   - Client Secret
   - Azure Tenant ID (this is what restricts login to the CitroTech tenant)
3. Save.

---

## 3. Local env file

```bash
cp .env.example .env.local
```

Fill in the values from steps 1–2. Set `ADMIN_EMAILS` to your own email so you
get ADMIN role on first login.

---

## 4. Install, migrate, seed

```bash
npm install
npm run db:migrate     # creates tables (name the migration when prompted)
npm run db:seed        # loads 3 techs, 3 checklist templates, 18 sample jobs
npm run dev            # start the app at http://localhost:3000
```

---

## 5. First login

1. Visit http://localhost:3000 → redirects to `/login`.
2. Click **Sign in with Microsoft** → authenticate.
3. You're redirected back. On first login, your User row is created; the email
   listed in `ADMIN_EMAILS` gets `ADMIN` role automatically. Everyone else
   defaults to `VIEWER` — an admin can promote them via Prisma Studio
   (`npm run db:studio`) until the settings UI ships in a later phase.

---

## Useful scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run db:generate` | Regenerate Prisma Client after schema changes |
| `npm run db:push` | Push schema without a migration (dev only) |
| `npm run db:migrate` | Create and apply a new migration |
| `npm run db:reset` | Drop all data, re-apply migrations, re-seed |
| `npm run db:seed` | Re-run seed script (idempotent for seed-tagged rows) |
| `npm run db:studio` | Open Prisma Studio to browse/edit data |

---

## Troubleshooting

**"DATABASE_URL is not set"** — check that `.env.local` exists and has the
values from Supabase. Restart `npm run dev`.

**"Invalid login: email not confirmed"** — Supabase sometimes requires email
confirmation for the Microsoft provider. In Supabase → Authentication →
Providers → Azure, ensure "Skip nonce check" is off and retry.

**Login succeeds but the app says "Not authenticated"** — the middleware is
likely not refreshing the session. Confirm that `src/middleware.ts` exists and
matches the route pattern.

**Tech users can't see any jobs after login** — new users default to `VIEWER`.
Promote Mike/Carlos/Dave to `TECH` in Prisma Studio, or set their email in
`ADMIN_EMAILS` and re-login (admin-only workaround until settings UI ships).
