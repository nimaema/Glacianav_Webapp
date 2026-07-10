"use client";

import { useState } from "react";
import { ArrowRight, CircleNotch, ShieldCheck } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";
import { FrontBadge } from "@/components/ui/front-badge";

// Microsoft's own "M" glyph, inline (no icon-font entry for it in Phosphor —
// this is the one spot in the app that isn't Phosphor, by necessity).
function MicrosoftMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 21 21" aria-hidden>
      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

function BrandRings({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <circle cx="16" cy="16" r="13.5" stroke="var(--accent)" strokeWidth="1.4" opacity="0.35" />
      <circle cx="16" cy="16" r="9.5" stroke="var(--accent)" strokeWidth="1.4" opacity="0.6" />
      <circle cx="16" cy="16" r="5.5" stroke="var(--accent)" strokeWidth="1.6" opacity="0.85" />
      <circle cx="16" cy="16" r="2" fill="var(--accent-strong)" />
    </svg>
  );
}

/**
 * The synoptic field behind the chart panel: hand-plotted isobar contours
 * plus one faint pressure system. Purely decorative — the weather-front
 * legend below it carries the actual meaning.
 */
function IsobarField() {
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 760 900"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
    >
      <g stroke="var(--accent)" strokeWidth="1.1">
        <path d="M-40 170 C 140 120, 300 210, 480 160 S 760 90, 820 140" opacity="0.14" />
        <path d="M-40 250 C 150 200, 320 300, 500 245 S 770 175, 830 230" opacity="0.11" />
        <path d="M-40 340 C 160 290, 330 400, 520 335 S 780 265, 840 325" opacity="0.09" />
        <path d="M-40 560 C 170 620, 340 500, 530 570 S 790 660, 850 600" opacity="0.09" />
        <path d="M-40 650 C 180 710, 350 590, 540 665 S 800 755, 860 695" opacity="0.11" />
        <path d="M-40 740 C 190 800, 360 680, 550 760 S 810 850, 870 790" opacity="0.14" />
      </g>
      <g stroke="var(--aurora-2)" strokeWidth="1.1">
        <circle cx="565" cy="435" r="46" opacity="0.28" />
        <circle cx="565" cy="435" r="82" opacity="0.18" />
        <circle cx="565" cy="435" r="122" opacity="0.11" />
        <circle cx="565" cy="435" r="166" opacity="0.06" />
      </g>
      <circle cx="565" cy="435" r="3" fill="var(--aurora-2)" opacity="0.6" />
    </svg>
  );
}

const STAGE_LEGEND = [
  { tone: "blue", label: "Interview" },
  { tone: "coral", label: "Review" },
  { tone: "violet", label: "Decision" },
  { tone: "green", label: "Signed" },
] as const;

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
    <div className="grid min-h-[100dvh] bg-page lg:grid-cols-[1.15fr_minmax(440px,1fr)]">
      {/* ─── The chart panel ─── */}
      <section
        aria-hidden
        className="login-aurora relative hidden overflow-hidden border-r border-line bg-page-2 lg:block"
      >
        <IsobarField />

        <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
          <div className="anim-login-rise flex items-center gap-3">
            <BrandRings size={38} />
            <div>
              <p className="text-[17px] font-semibold tracking-[-0.01em] text-ink">GlaciaNav</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-3">Aurora Chart</p>
            </div>
          </div>

          <div className="max-w-[46rem]">
            <h2
              className="anim-login-rise text-[clamp(2.1rem,3.4vw,3.1rem)] font-semibold leading-[1.06] tracking-[-0.03em] text-ink"
              style={{ animationDelay: "80ms" }}
            >
              Every customer conversation, on one chart.
            </h2>
            <p
              className="anim-login-rise mt-4 max-w-[44ch] text-[15.5px] leading-relaxed text-ink-2"
              style={{ animationDelay: "160ms" }}
            >
              Recordings become transcripts, decisions, and follow-ups. Accounts move through the front
              like weather — and the whole team reads the same map.
            </p>
          </div>

          <div className="anim-login-rise flex flex-col gap-3" style={{ animationDelay: "240ms" }}>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-3">
              Validation stages
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {STAGE_LEGEND.map((s) => (
                <FrontBadge key={s.label} tone={s.tone} label={s.label} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── The sign-in column ─── */}
      <main className="relative flex flex-col justify-between overflow-hidden px-6 py-8 sm:px-12 lg:px-14 xl:px-20">
        {/* small screens don't get the chart panel — a quiet aurora crown
            at the top carries the identity instead */}
        <div aria-hidden className="login-aurora pointer-events-none absolute inset-x-0 top-0 h-56 lg:hidden" />
        {/* compact brand header for small screens */}
        <div className="anim-login-rise flex items-center gap-2.5 lg:invisible">
          <BrandRings size={30} />
          <div>
            <p className="text-[15px] font-semibold tracking-[-0.01em] text-ink">GlaciaNav</p>
            <p className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-3">Aurora Chart</p>
          </div>
        </div>

        <div className="w-full max-w-[360px] self-center">
          <h1
            className="anim-login-rise text-[27px] font-semibold leading-tight tracking-[-0.02em] text-ink"
            style={{ animationDelay: "120ms" }}
          >
            Welcome back.
          </h1>
          <p
            className="anim-login-rise mt-2 text-[14.5px] leading-relaxed text-ink-2"
            style={{ animationDelay: "180ms" }}
          >
            Sign in with your GlaciaNav Microsoft account to open the workspace.
          </p>

          <button
            type="button"
            onClick={signInWithMicrosoft}
            disabled={loading}
            className="anim-login-rise rounded-control group mt-8 flex h-12 w-full cursor-pointer items-center gap-3 bg-accent pl-1.5 pr-4 text-left text-[14.5px] font-bold text-white transition-colors duration-150 hover:bg-accent-strong disabled:cursor-wait disabled:opacity-70"
            style={{ animationDelay: "240ms" }}
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-white">
              <MicrosoftMark size={16} />
            </span>
            <span className="min-w-0 flex-1">
              {loading ? "Opening Microsoft sign-in…" : "Continue with Microsoft"}
            </span>
            {loading ? (
              <CircleNotch size={17} className="shrink-0 animate-spin" />
            ) : (
              <ArrowRight
                size={17}
                weight="bold"
                className="shrink-0 transition-transform duration-150 group-hover:translate-x-1"
              />
            )}
          </button>

          {error && (
            <div
              role="alert"
              className="anim-login-rise mt-4 rounded-control border border-danger/25 bg-danger/5 px-3.5 py-3"
            >
              <p className="text-[13px] font-bold text-danger">Sign-in didn&rsquo;t start</p>
              <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{error}</p>
            </div>
          )}

          <div
            className="anim-login-rise mt-8 flex items-start gap-2.5 border-t border-line-2 pt-5"
            style={{ animationDelay: "300ms" }}
          >
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-ink-3" />
            <p className="text-[12.5px] leading-relaxed text-ink-3">
              Access is limited to <span className="font-semibold text-ink-2">glacianav.com</span> accounts.
              Ask an admin if you need to be added.
            </p>
          </div>
        </div>

        <p
          className="anim-login-rise text-center font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3 lg:text-left"
          style={{ animationDelay: "360ms" }}
        >
          GlaciaNav workspace · Secured with Microsoft Entra ID
        </p>
      </main>
    </div>
  );
}
