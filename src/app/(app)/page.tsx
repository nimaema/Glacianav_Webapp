import { SurfaceReveal } from "@/components/motion/surface-reveal";
import { HeaderBand } from "@/components/home/header-band";
import { UpNextCard } from "@/components/home/up-next-card";
import { AttentionQueue } from "@/components/home/attention-queue";
import { RecentConversations } from "@/components/home/recent-conversations";
import { ActivityCard, PipelineCard, TodayCard } from "@/components/home/side-cards";
import { getCurrentProfile } from "@/lib/data/current-user";
import { getHomeData } from "@/lib/data/home";

// Reads live DB data — DATABASE_URL isn't available at Docker build time
// (deliberately kept server-only, out of the build stage), so this can't
// be statically prerendered. Was previously relying on implicit dynamic
// inference via layout.tsx's cookies() usage, which turned out to be
// fragile — an unrelated layout change (adding another DB call) flipped
// this page back to trying to statically export and broke the build.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const profile = await getCurrentProfile();
  // AUTH_REQUIRED is off in local dev by default (see src/proxy.ts) — a
  // signed-out visit is possible there. Once gating is on everywhere this
  // shouldn't happen, but fail into an honest empty state rather than a
  // crash if it ever does.
  const data = profile
    ? await getHomeData(profile.id, profile.name)
    : await getHomeData(null, "there");

  const topItem = data.attention[0];

  return (
    <SurfaceReveal>
      <HeaderBand greetingName={data.greetingName} stats={data.stats} />
      <div className="mx-auto max-w-[1680px] px-5 py-8 sm:px-7 lg:px-10 lg:py-10">
        <UpNextCard topItem={topItem} />
        <div className="mt-10 grid grid-cols-1 gap-10 xl:grid-cols-12">
          <div className="min-w-0 xl:col-span-7">
            <AttentionQueue items={data.attention} skipId={topItem?.id} />
          </div>
          <aside className="flex flex-col gap-5 border-t border-ink pt-6 xl:col-span-5 xl:border-l xl:border-t-0 xl:pl-8 xl:pt-0">
            <TodayCard />
            <PipelineCard cadence={data.cadence} hasAnyCustomers={data.hasAnyCustomers} />
            <ActivityCard items={data.recentActivity} />
          </aside>
        </div>
        <div className="mt-12"><RecentConversations items={data.recentConversations} /></div>
      </div>
    </SurfaceReveal>
  );
}
