"use client";

import { Gear } from "@phosphor-icons/react";
import { ModuleStub } from "@/components/ui/module-stub";

export default function SettingsPage() {
  return (
    <ModuleStub
      title="Settings"
      icon={Gear}
      description="Profile, calendar feeds, notification preferences, integrations (Slack, Google, Teams), and security."
      next="Arrives with Supabase auth."
    />
  );
}