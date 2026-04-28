# CitroTechnician — Setup

One-time setup for running the app locally and provisioning external services.
Phase 1 only requires **Supabase + Google auth**. Google Maps and Salesforce
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

## 2. Google OAuth

Lets CitroTech staff sign in with their `@citrotech.com` Google
account (Workspace, or any Google identity an admin pre-invites).

**In Google Cloud Console (https://console.cloud.google.com):**
1. Create or reuse a project.
2. **APIs & Services → OAuth consent screen** → set up:
   - User type: **Internal** if your CitroTech Google Workspace org
     is the project owner (auto-restricts sign-in to org members).
     **External** otherwise — access is gated downstream by the
     allowlist (see below), so this is safe.
   - App name: `CitroTechnician`
   - Support email: an admin address.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID:**
   - Application type: **Web application**
   - Name: `CitroTechnician`
   - Authorized redirect URI:
     `https://[project].supabase.co/auth/v1/callback`
     (use your Supabase project URL).
4. Save. Copy the **Client ID** and **Client secret**.

**In Supabase:**
1. Authentication → Providers → **Google** → toggle on.
2. Paste:
   - Client ID
   - Client Secret
3. Save.

**Email allowlist — the actual access gate:**
Sign-in is technically open at the provider level. The app-side
gate lives in `src/app/auth/callback/route.ts` and lets a user
through only if their email is on the `ADMIN_EMAILS` env var
**or** they already have an active `User` row (added by an
existing admin from `Settings → Team`). Everyone else bounces back
to `/login` with a "not invited" message — no User row is created.
This means you don't need a domain restriction at the provider
level; you control access by curating the team list.

---

## 3. Google Maps API key (Phase 4)

The map view and calendar require a Google Maps JavaScript API key.

1. Go to https://console.cloud.google.com → create a project (or reuse one).
2. **APIs & Services → Library** → enable **Maps JavaScript API**.
3. **APIs & Services → Credentials** → **Create credentials → API key**.
4. Restrict the key:
   - **Application restrictions:** HTTP referrers → add
     `http://localhost:3000/*` and your production domain
   - **API restrictions:** Maps JavaScript API only
5. Copy the key into `.env.local` as both `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
   (client-side) and `GOOGLE_MAPS_API_KEY` (reserved for server-side
   geocoding in Phase 4.5 / CSV import).

Estimated cost: free tier ($200/mo credit) covers ~28,000 map loads —
CitroTech's 5 internal users at ~10 loads/day = 1,500/mo, well within free.

---

## 4. Local env file

```bash
cp .env.example .env.local
```

Fill in the values from steps 1–3. Set `ADMIN_EMAILS` to your own email so you
get ADMIN role on first login.

---

## 5. Install, migrate, seed

```bash
npm install
npm run db:migrate     # creates tables (name the migration when prompted)
npm run db:seed        # loads 3 techs, 3 checklist templates, 18 sample jobs
npm run dev            # start the app at http://localhost:3000
```

---

## 6. First login

1. Visit http://localhost:3000 → redirects to `/login`.
2. Click **Continue with Google** → authenticate.
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

**"X isn't on the invite list" after sign-in** — your email isn't on the
`ADMIN_EMAILS` env var **and** doesn't exist as an active `User` row. Add
your email to `ADMIN_EMAILS` in `.env.local` (and on Vercel for production)
to bootstrap as admin, or have an existing admin add you from
`Settings → Team`.

**Sign-in loops back to /login** — usually a cookie / in-app-browser issue.
Open the URL in a real browser (Safari on iPhone, Chrome on Android,
Edge/Chrome on desktop), not a webview inside Messages/Slack/Gmail.

**Login succeeds but the app says "Not authenticated"** — the middleware is
likely not refreshing the session. Confirm that `src/middleware.ts` exists and
matches the route pattern.

**Tech users can't see any jobs after login** — new users default to `VIEWER`.
Promote Mike/Carlos/Dave to `TECH` in Prisma Studio, or set their email in
`ADMIN_EMAILS` and re-login (admin-only workaround until settings UI ships).
