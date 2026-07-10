import { AdminView } from "@/components/admin/admin-view";
import { getAdminPageData } from "@/lib/data/settings";

// Reads live DB data — DATABASE_URL isn't available at Docker build time
// (deliberately kept server-only, out of the build stage), so this can't
// be statically prerendered.
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const data = await getAdminPageData();
  return <AdminView {...data} />;
}
