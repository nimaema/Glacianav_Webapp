"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Compass } from "@phosphor-icons/react";

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
    // On success the browser navigates away to Microsoft’s login page.
    // nothing left to render here.
  };

  return (
    <div className="grid min-h-[100dvh] bg-ice-0 lg:grid-cols-[1.12fr_.88fr]">
      <section className="relative hidden overflow-hidden border-r border-ink bg-signal p-10 lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div aria-hidden className="absolute inset-0 opacity-30" style={{ backgroundImage: "linear-gradient(rgba(22,34,29,.16) 1px, transparent 1px), linear-gradient(90deg, rgba(22,34,29,.16) 1px, transparent 1px)", backgroundSize: "80px 80px" }} />
        <div className="relative flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center bg-ink text-signal"><Compass size={23} weight="fill" /></span>
          <span className="font-display text-[22px] font-semibold tracking-[-0.03em] text-ink">GlaciaNav</span>
        </div>
        <div className="relative max-w-[620px]">
          <p className="mb-6 text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-2">Relationship intelligence</p>
          <h1 className="font-display text-[clamp(4rem,7vw,8rem)] font-semibold leading-[.78] tracking-[-0.075em] text-ink">Know the next move.</h1>
          <p className="mt-6 max-w-[52ch] text-[17px] leading-[1.5] text-ink-2">Conversations, commitments, and customer context stay connected in one clear workspace.</p>
        </div>
        <ol className="relative grid max-w-[620px] grid-cols-3 border-l border-t border-ink">
          {["Map the work", "Keep context", "Find the signal"].map((label, index) => <li key={label} className="border-b border-r border-ink p-4 text-[12px] font-semibold text-ink"><span className="mb-5 block text-[10px] text-ink-2">0{index + 1}</span>{label}</li>)}
        </ol>
      </section>

      <main className="command-canvas flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-[430px]">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <span className="grid h-10 w-10 place-items-center bg-ink text-signal"><Compass size={21} weight="fill" /></span>
            <span className="font-display text-[21px] font-semibold tracking-[-0.03em] text-ink">GlaciaNav</span>
          </div>
          <div className="border-y border-ink bg-surface px-1 py-8 sm:py-10">
            <h2 className="font-display text-[44px] font-semibold leading-none tracking-[-0.045em] text-ink">Welcome back</h2>
            <p className="mt-2 max-w-[36ch] text-[14px] leading-[1.5] text-ink-2">Sign in with your GlaciaNav Microsoft 365 account.</p>
            <button type="button" onClick={signInWithMicrosoft} disabled={loading} className="mt-8 flex h-12 w-full cursor-pointer items-center justify-center gap-2.5 bg-ink text-[14px] font-semibold text-deep-ink hover:bg-deep-2 disabled:cursor-not-allowed disabled:opacity-60">
              <MicrosoftMark />
              {loading ? "Redirecting…" : "Continue with Microsoft"}
            </button>
            {error && <p className="mt-4 border-l-4 border-danger bg-danger/10 px-3 py-2.5 text-[13px] leading-snug text-danger" role="alert">{error}</p>}
          </div>
          <p className="mt-5 text-center text-[12px] leading-[1.5] text-ink-3">Access is limited to glacianav.com accounts. Contact an admin if you need access.</p>
        </div>
      </main>
    </div>
  );
}
