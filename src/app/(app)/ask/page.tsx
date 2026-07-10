import { AskView } from "@/components/ask/ask-view";
import { getAskPageData } from "@/lib/data/ask";
import { getCurrentProfile } from "@/lib/data/current-user";

// Reads live DB data — DATABASE_URL isn't available at Docker build time
// (deliberately kept server-only, out of the build stage), so this can't
// be statically prerendered.
export const dynamic = "force-dynamic";

export default async function AskPage() {
  const [data, profile] = await Promise.all([getAskPageData(), getCurrentProfile()]);
  return <AskView {...data} currentUserId={profile?.id ?? ""} />;
}
