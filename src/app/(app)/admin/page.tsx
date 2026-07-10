import { AdminView } from "@/components/admin/admin-view";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/data/current-user";
import { getAdminPageData } from "@/lib/data/settings";

// Reads live DB data — DATABASE_URL isn't available at Docker build time
// (deliberately kept server-only, out of the build stage), so this can't
// be statically prerendered.
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const profile = await getCurrentProfile();
  if (!profile?.active || profile.role !== "admin") redirect("/");
  const data = await getAdminPageData();
  return <AdminView {...data} currentUserId={profile.id} />;
}
