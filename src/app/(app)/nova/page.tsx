import { redirect } from "next/navigation";
import { NovaStudioView } from "@/components/nova-studio/nova-studio-view";
import { getCurrentProfile } from "@/lib/data/current-user";
import { getNovaStudioData } from "@/lib/data/nova-studio";

export const dynamic = "force-dynamic";

export default async function NovaStudioPage() {
  const profile = await getCurrentProfile();
  if (!profile?.active) redirect("/login");
  const data = await getNovaStudioData(profile);
  return <NovaStudioView data={data} />;
}
