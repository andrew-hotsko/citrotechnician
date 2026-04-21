"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <main className="relative min-h-screen grid place-items-center p-6 overflow-hidden">
      {/* Ambient orange halo in the background */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[520px] w-[900px] opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(ellipse at center, oklch(0.88 0.12 60 / 0.45) 0%, transparent 70%)",
        }}
        aria-hidden
      />
      {/* Subtle grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(to right, oklch(0.145 0 0) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.145 0 0) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
          maskImage: "radial-gradient(ellipse at center, black 35%, transparent 80%)",
        }}
        aria-hidden
      />

      <div className="relative w-full max-w-sm animate-enter">
        <div className="rounded-xl border border-neutral-200/80 bg-white/95 backdrop-blur p-8 shadow-elev-2 card-glow">
          <div className="flex flex-col items-center text-center mb-7">
            <div
              className="h-11 w-11 rounded-lg grid place-items-center text-white font-semibold text-lg shadow-elev-2 card-glow"
              style={{
                background:
                  "linear-gradient(135deg, oklch(0.68 0.19 42) 0%, oklch(0.6 0.21 38) 100%)",
              }}
            >
              C
            </div>
            <h1 className="text-[18px] font-semibold tracking-tight mt-4">
              CitroTech Jobs
            </h1>
            <p className="text-[13px] text-neutral-500 mt-1">
              Sign in to continue to your workspace
            </p>
          </div>

          <button
            type="button"
            onClick={signInWithGoogle}
            disabled={loading}
            className="group inline-flex w-full items-center justify-center gap-2 h-10 rounded-md bg-neutral-900 px-4 text-[13px] font-medium text-white shadow-elev-1 transition-all hover:bg-neutral-800 hover:shadow-elev-2 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Redirecting to Google…
              </>
            ) : (
              <>
                <GoogleMark />
                Sign in with Google
              </>
            )}
          </button>

          {error && (
            <p className="mt-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-[12px] text-red-700">
              {error}
            </p>
          )}

          <p className="mt-6 text-center text-[11px] text-neutral-400">
            Access is restricted to authorized CitroTech team members.
          </p>
        </div>
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
