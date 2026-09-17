import { AppShell } from "@/components/shell/app-shell";
import { viewer } from "@/lib/questionnaires/access";
import { localMode } from "@/lib/questionnaires/database";
import { getNotifications } from "@/lib/data/notifications";
import { getNovaContextData } from "@/lib/data/nova";
import "@/components/questionnaires/questionnaires.css";
export const dynamic = "force-dynamic";
export default async function QuestionnaireLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await viewer();
  const [nova, notifications] = localMode()
    ? [
        { customers: [], contacts: [], openTaskCountByCustomer: {} },
        { items: [], unreadCount: 0 },
      ]
    : await Promise.all([getNovaContextData(), getNotifications(profile.id)]);
  return (
    <AppShell
      currentUserId={profile.id}
      profile={profile}
      notifications={notifications.items}
      unreadCount={notifications.unreadCount}
      novaContext={nova}
    >
      {children}
    </AppShell>
  );
}
