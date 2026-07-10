"use client";

import { useState } from "react";
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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-page px-4">
      {/* The aurora restraint layer's other sanctioned spot, alongside the
          page-header band — a quiet luminous wash, never used anywhere else. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(720px 480px at 15% 8%, color-mix(in srgb, var(--aurora-1) 16%, transparent), transparent 65%), radial-gradient(640px 520px at 88% 92%, color-mix(in srgb, var(--aurora-3) 14%, transparent), transparent 60%)",
        }}
      />

      <div className="relative w-full max-w-[400px]">
        <div className="mb-8 flex items-center justify-center gap-3">
          <svg className="h-10 w-10 shrink-0" viewBox="0 0 32 32" fill="none" aria-hidden>
            <circle cx="16" cy="16" r="13.5" stroke="var(--accent)" strokeWidth="1.4" opacity="0.35" />
            <circle cx="16" cy="16" r="9.5" stroke="var(--accent)" strokeWidth="1.4" opacity="0.6" />
            <circle cx="16" cy="16" r="5.5" stroke="var(--accent)" strokeWidth="1.6" opacity="0.85" />
            <circle cx="16" cy="16" r="2" fill="var(--accent-strong)" />
          </svg>
          <div className="text-left">
            <p className="text-[16px] font-semibold tracking-[-0.01em] text-ink">GlaciaNav</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
              Aurora Chart
            </p>
          </div>
        </div>

        <div className="surfaced-lg p-8">
          <h1 className="text-[21px] font-semibold tracking-[-0.01em] text-ink">Sign in</h1>
          <p className="mt-1.5 text-[14px] leading-relaxed text-ink-2">
            Use your GlaciaNav Microsoft 365 account to continue.
          </p>

          <button
            type="button"
            onClick={signInWithMicrosoft}
            disabled={loading}
            className="rounded-control mt-7 flex h-11 w-full cursor-pointer items-center justify-center gap-2.5 border border-line bg-surface text-[14.5px] font-semibold text-ink transition-colors duration-150 hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <MicrosoftMark />
            {loading ? "Redirecting…" : "Sign in with Microsoft"}
          </button>

          {error && (
            <p className="mt-4 text-[13px] leading-snug text-danger" role="alert">
              {error}
            </p>
          )}
        </div>

        <p className="mt-6 text-center text-[12.5px] leading-snug text-ink-3">
          Access is limited to glacianav.com accounts.
          <br />
          Contact an admin if you need to be added.
        </p>
      </div>
    </div>
  );
}
