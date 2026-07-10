import { Suspense } from "react";
import { LibraryView } from "@/components/library/library-view";
import { getLibraryPageData } from "@/lib/data/library";
import { getCurrentProfile } from "@/lib/data/current-user";

// Reads live DB data — DATABASE_URL isn't available at Docker build time
// (deliberately kept server-only, out of the build stage), so this can't
// be statically prerendered.
export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const profile = await getCurrentProfile();
  const data = await getLibraryPageData(profile?.id ?? "");
  return (
    <Suspense>
      <LibraryView {...data} />
    </Suspense>
  );
}
