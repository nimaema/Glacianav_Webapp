import { Rail } from "./rail";
import { TopBar } from "./topbar";
import { CassDock } from "./cass-dock";
import { CommandPalette } from "./command-palette";
import { RecordingProvider } from "@/components/record/recording-provider";
import type { Profile } from "@/lib/auth/ensure-profile";
import type { NotificationItem } from "@/lib/data/notifications";

export function AppShell({
  children,
  currentUserId,
  profile,
  notifications,
  unreadCount,
}: {
  children: React.ReactNode;
  currentUserId: string;
  profile: Profile | null;
  notifications: NotificationItem[];
  unreadCount: number;
}) {
  return (
    <RecordingProvider currentUserId={currentUserId}>
      <div className="flex min-h-dvh overflow-hidden bg-deep">
        <Rail profile={profile} />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar profile={profile} notifications={notifications} unreadCount={unreadCount} />
          <main className="min-h-0 flex-1 overflow-y-auto bg-ice-0">{children}</main>
        </div>
        <CassDock />
        <CommandPalette />
      </div>
    </RecordingProvider>
  );
}
