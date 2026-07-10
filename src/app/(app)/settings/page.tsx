import { SettingsView } from "@/components/settings/settings-view";
import { getSettingsPageData } from "@/lib/data/settings";
import { getCurrentProfile } from "@/lib/data/current-user";

// Reads live DB data — DATABASE_URL isn't available at Docker build time
// (deliberately kept server-only, out of the build stage), so this can't
// be statically prerendered.
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const profile = await getCurrentProfile();
  const data = await getSettingsPageData(profile?.id ?? "");
  return <SettingsView {...data} currentUserId={profile?.id ?? ""} />;
}
