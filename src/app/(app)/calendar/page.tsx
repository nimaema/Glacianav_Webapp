import { CalendarView } from "@/components/calendar/calendar-view";
import { getCalendarPageData } from "@/lib/data/calendar";
import { getCurrentProfile } from "@/lib/data/current-user";

// Reads live DB data — DATABASE_URL isn't available at Docker build time
// (deliberately kept server-only, out of the build stage), so this can't
// be statically prerendered.
export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const profile = await getCurrentProfile();
  const data = await getCalendarPageData(profile?.id ?? "");
  return <CalendarView {...data} currentUserId={profile?.id ?? ""} />;
}
