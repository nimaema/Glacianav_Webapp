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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-deep px-4">
      {/* Same depth grammar as the rail: a quiet gradient wash, not a flat fill. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(720px 480px at 15% 8%, rgba(215,243,91,0.08), transparent 65%), radial-gradient(640px 520px at 88% 92%, rgba(215,243,91,0.05), transparent 60%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative w-full max-w-[400px]">
        <div className="mb-8 flex items-center justify-center gap-3">
          <span className="grid h-10 w-10 place-items-center bg-signal font-mono text-[15px] font-bold text-deep">
            GN
          </span>
          <div className="text-left">
            <p className="text-[16px] font-semibold tracking-[-0.01em] text-white">GlaciaNav</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-deep-ink-2">
              Field workspace
            </p>
          </div>
        </div>

        <div className="border border-white/10 bg-white/[0.03] p-8 backdrop-blur-sm">
          <h1 className="text-[21px] font-semibold tracking-[-0.01em] text-white">Sign in</h1>
          <p className="mt-1.5 text-[14px] leading-relaxed text-deep-ink-2">
            Use your GlaciaNav Microsoft 365 account to continue.
          </p>

          <button
            type="button"
            onClick={signInWithMicrosoft}
            disabled={loading}
            className="mt-7 flex h-11 w-full cursor-pointer items-center justify-center gap-2.5 border border-white/15 bg-white text-[14.5px] font-semibold text-[#111813] transition-colors duration-150 hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <MicrosoftMark />
            {loading ? "Redirecting…" : "Sign in with Microsoft"}
          </button>

          {error && (
            <p className="mt-4 text-[13px] leading-snug text-[#ff8a75]" role="alert">
              {error}
            </p>
          )}
        </div>

        <p className="mt-6 text-center text-[12.5px] leading-snug text-deep-ink-2">
          Access is limited to glacianav.com accounts.
          <br />
          Contact an admin if you need to be added.
        </p>
      </div>
    </div>
  );
}
