"use client";

import { ShieldCheck } from "@phosphor-icons/react";
import { ModuleStub } from "@/components/ui/module-stub";

export default function AdminPage() {
  return (
    <ModuleStub
      title="Admin"
      icon={ShieldCheck}
      description="Users and roles, Microsoft SSO, segments and statuses, tags, the intake form, queue health, and usage."
      next="Arrives with Supabase auth and the workspace kernel."
    />
  );
}