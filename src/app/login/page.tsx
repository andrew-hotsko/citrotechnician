"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signInWithMicrosoft() {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        scopes: "email openid profile",
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen grid place-items-center p-6">
      <div className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center gap-1 mb-8">
          <div className="h-10 w-10 rounded-md bg-orange-600 grid place-items-center text-white font-semibold text-lg">
            C
          </div>
          <h1 className="text-lg font-semibold tracking-tight mt-3">
            CitroTech Jobs
          </h1>
          <p className="text-sm text-neutral-500">
            Sign in with your CitroTech account
          </p>
        </div>

        <Button
          onClick={signInWithMicrosoft}
          disabled={loading}
          className="w-full h-10"
        >
          {loading ? "Redirecting…" : "Sign in with Microsoft"}
        </Button>

        {error ? (
          <p className="mt-4 text-sm text-red-600 text-center">{error}</p>
        ) : null}
      </div>
    </main>
  );
}
