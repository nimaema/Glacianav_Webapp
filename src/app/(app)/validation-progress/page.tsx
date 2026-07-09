import { Suspense } from "react";
import { ValidationProgressView } from "@/components/customers/validation-progress-view";
import { getCustomersPageData } from "@/lib/data/customers";

// Reads live DB data — DATABASE_URL isn't available at Docker build time
// (deliberately kept server-only, out of the build stage), so this can't
// be statically prerendered.
export const dynamic = "force-dynamic";

export default async function ValidationProgressPage() {
  const data = await getCustomersPageData();
  return (
    <Suspense>
      <ValidationProgressView {...data} />
    </Suspense>
  );
}
