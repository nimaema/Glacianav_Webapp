"use client";

import { useState } from "react";
import { CalendarBlank } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";

// Microsoft's own "M" glyph, inline (no icon-font entry for it in Phosphor —
// this is the one spot in the app that isn't Phosphor, by necessity).
function MicrosoftMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInWithMicrosoft = async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        scopes: "openid profile email",
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
    // On success the browser navigates away to Microsoft's login page —
    // nothing left to render here.
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,var(--ice-0),var(--ice-1))] px-4">
      <div className="surfaced-lg w-full max-w-[380px] p-8 text-center">
        <span
          aria-hidden
          className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-melt/10 text-melt ring-1 ring-melt/15"
        >
          <CalendarBlank size={22} weight="bold" />
        </span>
        <h1 className="text-[22px] font-semibold tracking-[-0.015em] text-ink">GlaciaNav</h1>
        <p className="mt-1.5 text-[14px] leading-snug text-ink-2">
          Sign in with your GlaciaNav Microsoft 365 account.
        </p>

        <button
          type="button"
          onClick={signInWithMicrosoft}
          disabled={loading}
          className="mt-6 flex h-11 w-full cursor-pointer items-center justify-center gap-2.5 rounded-md border border-line-2 bg-white text-[14.5px] font-semibold text-ink transition-colors duration-150 hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <MicrosoftMark />
          {loading ? "Redirecting…" : "Sign in with Microsoft"}
        </button>

        {error && (
          <p className="mt-4 text-[13px] leading-snug text-[#b23c2e]" role="alert">
            {error}
          </p>
        )}

        <p className="mt-6 text-[12px] leading-snug text-ink-3">
          Access is limited to glacianav.com accounts. Contact an admin if you
          need to be added.
        </p>
      </div>
    </div>
  );
}
