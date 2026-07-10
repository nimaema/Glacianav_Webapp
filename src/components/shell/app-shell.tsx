import { Rail } from "./rail";
import { TopBar } from "./topbar";
import { NovaDock } from "./nova-dock";
import { CommandPalette } from "./command-palette";
import { RecordingProvider } from "@/components/record/recording-provider";
import type { Profile } from "@/lib/auth/ensure-profile";
import type { NotificationItem } from "@/lib/data/notifications";
import type { NovaContextData } from "@/lib/data/nova";

export function AppShell({
  children,
  currentUserId,
  profile,
  notifications,
  unreadCount,
  novaContext,
}: {
  children: React.ReactNode;
  currentUserId: string;
  profile: Profile | null;
  notifications: NotificationItem[];
  unreadCount: number;
  novaContext: NovaContextData;
}) {
  return (
    <RecordingProvider currentUserId={currentUserId}>
      <div className="flex min-h-dvh overflow-hidden bg-page">
        <Rail profile={profile} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar profile={profile} notifications={notifications} unreadCount={unreadCount} />
          <main className="min-h-0 flex-1 overflow-y-auto bg-page">{children}</main>
        </div>
        <NovaDock context={novaContext} currentUserId={currentUserId} />
        <CommandPalette />
      </div>
    </RecordingProvider>
  );
}
