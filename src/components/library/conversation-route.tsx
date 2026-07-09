"use client";

import Link from "next/link";
import { ConversationWorkspace } from "@/components/library/workspace";
import { conversations, detailsFor } from "@/lib/fixtures";

export function ConversationRoute({ id }: { id: string }) {
  const conversation = conversations.find((c) => c.id === id);
  const details = detailsFor(id);

  if (!conversation || !details) {
    return (
      <div className="mx-auto max-w-[560px] px-7 py-16 text-center">
        <p className="text-[16px] font-semibold text-ink">Library item not found</p>
        <p className="mt-1.5 text-[14px] text-ink-2">
          It may have been removed, or this link is stale.
        </p>
        <Link
          href="/library"
          className="mt-4 inline-block text-[14px] font-bold text-melt transition-colors duration-150 hover:text-melt-strong"
        >
          Back to library
        </Link>
      </div>
    );
  }

  return <ConversationWorkspace conversation={conversation} details={details} />;
}
