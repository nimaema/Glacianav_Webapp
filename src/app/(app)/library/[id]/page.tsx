import Link from "next/link";
import { ConversationWorkspace } from "@/components/library/workspace";
import { getConversationWorkspaceData } from "@/lib/data/library";
import { getCurrentProfile } from "@/lib/data/current-user";

// Reads live DB data — DATABASE_URL isn't available at Docker build time
// (deliberately kept server-only, out of the build stage), so this can't
// be statically prerendered.
export const dynamic = "force-dynamic";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  const data = await getConversationWorkspaceData(id, profile?.id ?? "");

  if (!data) {
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

  return (
    <ConversationWorkspace
      conversation={data.conversation}
      details={data.details}
      topics={data.topics}
      owners={data.owners}
      customers={data.customers}
      contacts={data.contacts}
      currentUserId={data.currentUserId}
    />
  );
}
