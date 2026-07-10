import { Suspense } from "react";
import { RecordView } from "@/components/record/record-view";
import { getRecordPageData } from "@/lib/data/library";
import { getCurrentProfile } from "@/lib/data/current-user";

// Reads live DB data — DATABASE_URL isn't available at Docker build time
// (deliberately kept server-only, out of the build stage), so this can't
// be statically prerendered.
export const dynamic = "force-dynamic";

export default async function RecordPage() {
  const [data, profile] = await Promise.all([getRecordPageData(), getCurrentProfile()]);
  return (
    <Suspense>
      <RecordView customers={data.customers} topics={data.topics} owners={data.owners} currentUserId={profile?.id ?? ""} />
    </Suspense>
  );
}
