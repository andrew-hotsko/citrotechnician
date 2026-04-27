"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState<{
    reason: string | null;
    email: string | null;
    error: string | null;
  }>({ reason: null, email: null, error: null });

  // Read URL params on mount — done via window to avoid the Suspense
  // boundary dance that useSearchParams requires.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setParams({
      reason: sp.get("reason"),
      email: sp.get("email"),
      error: sp.get("error"),
    });
  }, []);

  const { reason, email: deniedEmail, error: urlError } = params;

  async function signInWithGoogle() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes: "email profile openid",
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          prompt: "select_account",
          access_type: "offline",
        },
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen grid place-items-center p-6 bg-neutral-50">
      {/* Hairline grid — very subtle; just enough to feel less flat
          without shouting "old-school HTML" like the halo did. */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(to right, oklch(0.2 0 0) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.2 0 0) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          maskImage:
            "radial-gradient(ellipse at center, black 40%, transparent 75%)",
        }}
        aria-hidden
      />

      <div className="relative w-full max-w-[380px] animate-enter">
        {/* Brand block — lives above the card so the card reads as
            form-only, like Linear / Vercel / Notion auth screens. */}
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div
            className="h-8 w-8 rounded-lg grid place-items-center text-white text-[13px] font-semibold shadow-elev-1"
            style={{ backgroundColor: "oklch(0.64 0.19 42)" }}
          >
            C
          </div>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-tight text-neutral-900">
              CitroTech
            </div>
            <div className="text-[9px] font-semibold tracking-[0.14em] text-neutral-500 uppercase">
              Technician
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-200/80 bg-white p-7 shadow-elev-2">
          <div className="mb-6">
            <h1 className="text-[18px] font-semibold tracking-tight text-neutral-900">
              Sign in
            </h1>
            <p className="text-[13px] text-neutral-600 mt-1">
              Continue to your workspace.
            </p>
          </div>

          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={loading}
            className="group inline-flex w-full items-center justify-center gap-2 h-10 rounded-lg bg-neutral-900 px-4 text-[13px] font-medium text-white shadow-elev-1 transition-all hover:bg-neutral-800 hover:shadow-elev-2 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Redirecting to Google…
              </>
            ) : (
              <>
                <GoogleMark />
                Continue with Google
              </>
            )}
          </button>

          {error && (
            <p className="mt-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">
              {error}
            </p>
          )}

          {reason === "not_invited" && (
            <div className="mt-4 rounded-md bg-amber-50 border border-amber-200 px-3 py-2.5 text-[12px] text-amber-900">
              <p className="font-medium">
                {deniedEmail
                  ? `${deniedEmail} isn't on the invite list.`
                  : "This Google account isn't on the invite list."}
              </p>
              <p className="mt-1 text-amber-800">
                Ask your admin to add you from Settings → Team, then try
                again with the same email.
              </p>
            </div>
          )}

          {urlError === "auth_failed" && !reason && (
            <p className="mt-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">
              Sign-in didn&apos;t complete. Try again.
            </p>
          )}
        </div>

        <p className="mt-5 text-center text-[11px] text-neutral-500">
          Access is restricted to authorized CitroTech team members.
        </p>
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" aria-hidden>
      <path
        fill="#ffffff"
        d="M21.35 11.1H12v3.2h5.35c-.23 1.45-1.48 4.25-5.35 4.25-3.22 0-5.85-2.67-5.85-5.95S8.78 6.65 12 6.65c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.67 4.08 14.54 3.2 12 3.2 6.99 3.2 2.95 7.22 2.95 12.2S6.99 21.2 12 21.2c6.93 0 9.2-4.86 9.2-7.4 0-.5-.06-.89-.15-1.28z"
      />
    </svg>
  );
}
