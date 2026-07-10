import { AppShell } from "@/components/shell/app-shell";
import { getCurrentProfile } from "@/lib/data/current-user";
import { getNotifications } from "@/lib/data/notifications";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getCurrentProfile();
  const { items: notifications, unreadCount } = await getNotifications(profile?.id ?? "");
  return (
    <AppShell currentUserId={profile?.id ?? ""} profile={profile} notifications={notifications} unreadCount={unreadCount}>
      {children}
    </AppShell>
  );
}
