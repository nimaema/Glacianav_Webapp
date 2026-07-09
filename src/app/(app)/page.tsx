import { SurfaceReveal } from "@/components/motion/surface-reveal";
import { HeaderBand } from "@/components/home/header-band";
import { UpNextCard } from "@/components/home/up-next-card";
import { AttentionQueue } from "@/components/home/attention-queue";
import { RecentConversations } from "@/components/home/recent-conversations";
import { ActivityCard, PipelineCard, TodayCard } from "@/components/home/side-cards";
import { getCurrentProfile } from "@/lib/data/current-user";
import { getHomeData } from "@/lib/data/home";

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
      <div className="mx-auto max-w-[1600px] px-7 py-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.9fr_1fr]">
          <div className="flex min-w-0 flex-col gap-5">
            <UpNextCard topItem={topItem} />
            <AttentionQueue items={data.attention} skipId={topItem?.id} />
          </div>
          <div className="flex flex-col gap-4">
            <TodayCard />
            <PipelineCard cadence={data.cadence} hasAnyCustomers={data.hasAnyCustomers} />
            <ActivityCard items={data.recentActivity} />
          </div>
        </div>
        <RecentConversations items={data.recentConversations} />
      </div>
    </SurfaceReveal>
  );
}
