"use client";

import { CalendarBlank } from "@phosphor-icons/react";
import { ModuleStub } from "@/components/ui/module-stub";

export default function CalendarPage() {
  return (
    <ModuleStub
      title="Calendar"
      icon={CalendarBlank}
      description="Layered week view over your connected ICS feeds, teammates as busy-only blocks, and computed shared free time."
      next="Feed sync arrives with the worker phase. Add-feed management will live in Settings."
    />
  );
}