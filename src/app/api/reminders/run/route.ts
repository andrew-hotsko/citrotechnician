import { NextResponse, type NextRequest } from "next/server";
import { runReminders } from "@/lib/reminders";
import { getCurrentUser } from "@/lib/auth";

/**
 * Runs the daily maintenance engine.
 *
 * Auth: accepts either
 *  - Authorization: Bearer <CRON_SECRET>  \u2190 what Vercel Cron sends
 *  - A signed-in ADMIN or OPS_MANAGER user \u2190 manual trigger from settings
 */
async function authorize(req: NextRequest): Promise<
  | { ok: true }
  | { ok: false; reason: string; status: number }
> {
  const bearer = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && bearer === `Bearer ${cronSecret}`) {
    return { ok: true };
  }

  // Manual trigger fallback \u2014 must be admin/ops.
  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, reason: "Unauthorized", status: 401 };
  }
  if (user.role !== "ADMIN" && user.role !== "OPS_MANAGER") {
    return { ok: false, reason: "Forbidden", status: 403 };
  }
  return { ok: true };
}

async function handle(req: NextRequest) {
  const auth = await authorize(req);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.reason },
      { status: auth.status },
    );
  }

  try {
    const result = await runReminders();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// Vercel Cron uses GET by default; accept POST too for flexibility.
export const GET = handle;
export const POST = handle;
