import { AppShell } from "@/components/shell/app-shell";
import { getCurrentProfile } from "@/lib/data/current-user";
import { getNotifications } from "@/lib/data/notifications";
import { getNovaContextData } from "@/lib/data/nova";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [profile, novaContext] = await Promise.all([getCurrentProfile(), getNovaContextData()]);
  const { items: notifications, unreadCount } = await getNotifications(profile?.id ?? "");
  return (
    <AppShell
      currentUserId={profile?.id ?? ""}
      profile={profile}
      notifications={notifications}
      unreadCount={unreadCount}
      novaContext={novaContext}
    >
      {children}
    </AppShell>
  );
}
