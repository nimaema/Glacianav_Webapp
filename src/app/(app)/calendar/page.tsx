import { CalendarView } from "@/components/calendar/calendar-view";
import { getCalendarPageData } from "@/lib/data/calendar";
import { syncAllUserFeeds } from "@/lib/data/calendar-sync";
import { getCurrentProfile } from "@/lib/data/current-user";

// Reads live DB data — DATABASE_URL isn't available at Docker build time
// (deliberately kept server-only, out of the build stage), so this can't
// be statically prerendered.
export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const profile = await getCurrentProfile();
  const profileId = profile?.id ?? "";
  if (profileId) {
    await syncAllUserFeeds(profileId);
  }
  const data = await getCalendarPageData(profileId);
  return <CalendarView {...data} currentUserId={profileId} />;
}
