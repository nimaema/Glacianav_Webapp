import { EnvelopeSimple, LinkedinLogo, Phone } from "@phosphor-icons/react";
import { Pill } from "@/components/ui/pill";
import { FrontBadge } from "@/components/ui/front-badge";
import {
  stageByKey,
  stages as defaultStages,
  type ContactChannel,
  type Customer,
  type Stage,
  type StageKey,
} from "@/lib/fixtures";

export function StagePill({
  stage,
  stages = defaultStages,
}: {
  stage: StageKey;
  stages?: Stage[];
}) {
  const s = stageByKey(stage, stages);
  return (
    <span className="inline-flex items-center gap-1.5">
      <FrontBadge tone={s.tone} />
      <Pill tone={s.tone}>{s.label}</Pill>
    </span>
  );
}

export function FollowupPill({ followup }: { followup: Customer["followup"] }) {
  if (followup === "set") return <Pill tone="green">Follow-up set</Pill>;
  if (followup === "overdue") return <Pill tone="coral">Overdue</Pill>;
  return <Pill tone="gray">None</Pill>;
}

export function ProblemPill({ problem }: { problem: Customer["problem"] }) {
  if (problem === "yes") return <Pill tone="violet">Problem: yes</Pill>;
  if (problem === "no") return <Pill tone="gray">Problem: no</Pill>;
  return <Pill tone="gray">Unknown</Pill>;
}

export function PriorityPill({ priority }: { priority: Customer["priority"] }) {
  if (priority === "high") return <Pill tone="coral">High priority</Pill>;
  if (priority === "medium") return <Pill tone="blue">Medium priority</Pill>;
  if (priority === "low") return <Pill tone="gray">Low priority</Pill>;
  return <Pill tone="gray">No priority</Pill>;
}

const CHANNEL_META: Record<
  ContactChannel,
  { icon: typeof EnvelopeSimple; label: string }
> = {
  email: { icon: EnvelopeSimple, label: "Email" },
  linkedin: { icon: LinkedinLogo, label: "LinkedIn" },
  phone: { icon: Phone, label: "Phone" },
};

export function ChannelBadge({ channel }: { channel: ContactChannel | undefined }) {
  if (!channel) return <span className="text-[13px] text-ink-3">-</span>;
  const { icon: IconEl, label } = CHANNEL_META[channel];
  return (
    <span className="flex items-center gap-1.5 text-[13px] text-ink-2">
      <IconEl size={14} className="text-ink-3" />
      {label}
    </span>
  );
}
