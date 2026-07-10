import { WorkView } from "@/components/work/work-view";
import { getWorkPageData } from "@/lib/data/work";
import { getCurrentProfile } from "@/lib/data/current-user";

// Reads live DB data — DATABASE_URL isn't available at Docker build time
// (deliberately kept server-only, out of the build stage), so this can't
// be statically prerendered.
export const dynamic = "force-dynamic";

export default async function WorkPage() {
  const [data, profile] = await Promise.all([getWorkPageData(), getCurrentProfile()]);
  return <WorkView {...data} currentUserId={profile?.id ?? ""} />;
}
