import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

const adminEmails = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/**
 * Returns true if the email is allowed to sign in. Allowed = either
 *   - on the bootstrap ADMIN_EMAILS allowlist (for the first admin), or
 *   - already has a User row (invited from the Team page, seeded, or
 *     a previously-linked account).
 *
 * This gates sign-in at the door instead of silently creating a Viewer
 * for every Google account that happens to find the URL.
 */
async function isInvited(email: string): Promise<boolean> {
  if (adminEmails.includes(email.toLowerCase())) return true;
  const existing = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, deletedAt: true, active: true },
  });
  return Boolean(existing && !existing.deletedAt && existing.active);
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  // Gate: check the email against the invite list.
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  const email = (authUser?.email ?? "").toLowerCase();

  if (!email || !(await isInvited(email))) {
    // Not invited — kill the Supabase session so refreshing /login
    // doesn't silently re-auth them, then send back with a clear msg.
    await supabase.auth.signOut();
    const redirectUrl = new URL(`${origin}/login`);
    redirectUrl.searchParams.set("reason", "not_invited");
    if (email) redirectUrl.searchParams.set("email", email);
    return NextResponse.redirect(redirectUrl.toString());
  }

  const user = await getCurrentUser();
  const destination =
    next ?? (user?.role === "TECH" ? "/tech" : "/dashboard");
  return NextResponse.redirect(`${origin}${destination}`);
}
