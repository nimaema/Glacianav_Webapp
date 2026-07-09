"use client";

import { ListChecks } from "@phosphor-icons/react";
import { ModuleStub } from "@/components/ui/module-stub";

export default function WorkPage() {
  return (
    <ModuleStub
      title="Work"
      icon={ListChecks}
      description="One task center: extracted action items, follow-ups, scheduled interviews, and stale alerts, grouped by urgency with source chips."
      next="The Home attention queue already shows today's slice; the full center lands with the tasks kernel."
    />
  );
}