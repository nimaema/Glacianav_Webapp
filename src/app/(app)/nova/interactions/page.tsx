import { redirect } from "next/navigation";
import { NovaInteractionGallery } from "@/components/nova-studio/nova-interaction-gallery";
import { getCurrentProfile } from "@/lib/data/current-user";

export const dynamic = "force-dynamic";

export default async function NovaInteractionsPage() {
  const profile = await getCurrentProfile();
  if (!profile?.active) redirect("/login");
  return <NovaInteractionGallery />;
}
