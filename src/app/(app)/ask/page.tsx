"use client";

import { Sparkle } from "@phosphor-icons/react";
import { ModuleStub } from "@/components/ui/module-stub";

export default function AskPage() {
  return (
    <ModuleStub
      title="Ask"
      icon={Sparkle}
      description="Full-page Cass: thread history, scope chips (workspace, project, customer, conversation), and citations that jump into audio."
      next="The Cass dock (bottom right) already shows the interaction pattern; retrieval lands with pgvector."
    />
  );
}