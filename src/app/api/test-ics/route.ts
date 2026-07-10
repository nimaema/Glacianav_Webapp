// Test endpoint for debugging ICS fetch issues
import { NextRequest, NextResponse } from "next/server";
import { fetchIcsFeed } from "@/lib/ical/parse";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const url = searchParams.get("url");

  if (!url) {
    return NextResponse.json(
      {
        error: "Missing URL parameter",
        usage: "?url=https://example.com/calendar.ics",
      },
      { status: 400 }
    );
  }

  try {
    console.log(`[ICS Test] Fetching: ${url}`);
    const result = await fetchIcsFeed(url);

    return NextResponse.json({
      success: true,
      url,
      calendarName: result.calendar.name || "Unnamed",
      eventCount: result.calendar.events.length,
      etag: result.etag || null,
      firstEvent: result.calendar.events[0] || null,
      sampleEvents: result.calendar.events.slice(0, 3),
    });
  } catch (error) {
    console.error(`[ICS Test] Error:`, error);

    return NextResponse.json(
      {
        success: false,
        url,
        error: error instanceof Error ? error.message : "Unknown error",
        type: error instanceof Error ? error.constructor.name : typeof error,
      },
      { status: 500 }
    );
  }
}
