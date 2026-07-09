import { Rail } from "./rail";
import { TopBar } from "./topbar";
import { CassDock } from "./cass-dock";
import { CommandPalette } from "./command-palette";
import { RecordingProvider } from "@/components/record/recording-provider";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <RecordingProvider>
      <div className="flex h-dvh overflow-hidden">
        <Rail />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
        </div>
        <CassDock />
        <CommandPalette />
      </div>
    </RecordingProvider>
  );
}
