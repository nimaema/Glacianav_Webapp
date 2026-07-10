import { AppShell } from "@/components/shell/app-shell";
import { getCurrentProfile } from "@/lib/data/current-user";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  return <AppShell currentUserId={profile?.id ?? ""}>{children}</AppShell>;
}
