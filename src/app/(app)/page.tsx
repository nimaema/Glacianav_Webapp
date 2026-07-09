import { SurfaceReveal } from "@/components/motion/surface-reveal";
import { HeaderBand } from "@/components/home/header-band";
import { UpNextCard } from "@/components/home/up-next-card";
import { AttentionQueue } from "@/components/home/attention-queue";
import { RecentConversations } from "@/components/home/recent-conversations";
import { ActivityCard, PipelineCard, TodayCard } from "@/components/home/side-cards";

export default function HomePage() {
  return (
    <SurfaceReveal>
      <HeaderBand />
      <div className="mx-auto max-w-[1600px] px-7 py-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.9fr_1fr]">
          <div className="flex min-w-0 flex-col gap-5">
            <UpNextCard />
            <AttentionQueue />
          </div>
          <div className="flex flex-col gap-4">
            <TodayCard />
            <PipelineCard />
            <ActivityCard />
          </div>
        </div>
        <RecentConversations />
      </div>
    </SurfaceReveal>
  );
}
