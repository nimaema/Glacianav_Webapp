"use client";

import { ChartBar } from "@phosphor-icons/react";
import { ModuleStub } from "@/components/ui/module-stub";

export default function InsightsPage() {
  return (
    <ModuleStub
      title="Insights"
      icon={ChartBar}
      description="Funnel, needs frequency, problem confirmation, interview cadence, and owner workload. Every number clicks through to the quotes behind it."
      next="Charts activate once real conversations flow in; the Home pipeline pulse previews the shape."
    />
  );
}