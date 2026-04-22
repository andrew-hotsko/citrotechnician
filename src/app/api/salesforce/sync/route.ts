import { NextResponse, type NextRequest } from "next/server";
import { runSync } from "@/lib/salesforce/sync";
import { getCurrentUser } from "@/lib/auth";

/**
 * Same auth pattern as /api/reminders/run:
 *   - Vercel Cron: Authorization: Bearer $CRON_SECRET
 *   - Manual: signed-in admin or ops-manager session
 */
async function authorize(req: NextRequest): Promise<
  | { ok: true; userId?: string; via: "cron" | "session" }
  | { ok: false; reason: string; status: number }
> {
  const bearer = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && bearer === `Bearer ${cronSecret}`) {
    return { ok: true, via: "cron" };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { ok: false, reason: "Unauthorized", status: 401 };
  }
  if (user.role !== "ADMIN" && user.role !== "OPS_MANAGER") {
    return { ok: false, reason: "Forbidden", status: 403 };
  }
  return { ok: true, userId: user.id, via: "session" };
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
    const result = await runSync({
      triggeredBy: auth.via === "cron" ? "CRON" : "MANUAL",
      triggeredById: "userId" in auth ? auth.userId : undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
