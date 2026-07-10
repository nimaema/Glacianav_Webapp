import { InsightsView } from "@/components/insights/insights-view";
import { getInsightsPageData } from "@/lib/data/insights";

// Reads live DB data — DATABASE_URL isn't available at Docker build time
// (deliberately kept server-only, out of the build stage), so this can't
// be statically prerendered.
export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const data = await getInsightsPageData();
  return <InsightsView {...data} />;
}
