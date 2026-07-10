"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Compass, Path, Sparkle, UsersThree } from "@phosphor-icons/react";

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
    <div className="grid min-h-[100dvh] bg-ice-0 lg:grid-cols-[1.08fr_.92fr]">
      <section className="relative hidden overflow-hidden border-r border-line-2 bg-[#e9f0ff] p-12 lg:flex lg:flex-col lg:justify-between xl:p-16">
        <div aria-hidden className="absolute inset-0 opacity-45" style={{ backgroundImage: "linear-gradient(rgba(39,94,231,.09) 1px, transparent 1px), linear-gradient(90deg, rgba(39,94,231,.09) 1px, transparent 1px)", backgroundSize: "64px 64px" }} />
        <div className="relative flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-[15px] bg-melt text-white"><Compass size={24} weight="fill" /></span>
          <span className="text-[19px] font-semibold tracking-[-0.03em] text-ink">GlaciaNav</span>
        </div>
        <div className="relative max-w-[620px]">
          <p className="mb-5 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-melt">Relationship intelligence</p>
          <h1 className="text-[clamp(3rem,5vw,5.8rem)] font-semibold leading-[.96] tracking-[-0.065em] text-ink">Know the next move.</h1>
          <p className="mt-6 max-w-[52ch] text-[17px] leading-[1.5] text-ink-2">Conversations, commitments, and customer context stay connected in one clear workspace.</p>
        </div>
        <div className="relative grid max-w-[620px] grid-cols-3 gap-3">
          {[[Path, "Map the work"], [UsersThree, "Keep context"], [Sparkle, "Find the signal"]].map(([IconEl, label]) => {
            const FeatureIcon = IconEl as typeof Path;
            return <div key={label as string} className="rounded-[14px] border border-white/80 bg-white/65 p-4 text-[13px] font-medium text-ink-2 backdrop-blur-sm"><FeatureIcon size={19} className="mb-3 text-melt" />{label as string}</div>;
          })}
        </div>
      </section>

      <main className="flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-[430px]">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-[14px] bg-melt text-white"><Compass size={22} weight="fill" /></span>
            <span className="text-[18px] font-semibold tracking-[-0.03em] text-ink">GlaciaNav</span>
          </div>
          <div className="surfaced-lg p-6 sm:p-9">
            <h2 className="text-[30px] font-semibold tracking-[-0.04em] text-ink">Welcome back</h2>
            <p className="mt-2 max-w-[36ch] text-[14px] leading-[1.5] text-ink-2">Sign in with your GlaciaNav Microsoft 365 account.</p>
            <button type="button" onClick={signInWithMicrosoft} disabled={loading} className="mt-8 flex h-12 w-full cursor-pointer items-center justify-center gap-2.5 rounded-[13px] bg-ink text-[14px] font-semibold text-white hover:bg-ink-2 disabled:cursor-not-allowed disabled:opacity-60">
              <MicrosoftMark />
              {loading ? "Redirecting…" : "Continue with Microsoft"}
            </button>
            {error && <p className="mt-4 rounded-[10px] bg-danger/10 px-3 py-2.5 text-[13px] leading-snug text-danger" role="alert">{error}</p>}
          </div>
          <p className="mt-5 text-center text-[12px] leading-[1.5] text-ink-3">Access is limited to glacianav.com accounts. Contact an admin if you need access.</p>
        </div>
      </main>
    </div>
  );
}
