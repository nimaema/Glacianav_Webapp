import { getCurrentProfile } from "@/lib/data/current-user";
import { searchNovaWorkspace } from "@/lib/data/nova-studio";
import { searchWeb } from "@/lib/ai/web-search";

export async function GET(request: Request) {
  const profile = await getCurrentProfile();
  if (!profile?.active) return Response.json({ error: "Sign in to search with Nova." }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();
  if (query.length < 2) return Response.json({ error: "Enter at least two characters." }, { status: 400 });
  if (query.length > 300) return Response.json({ error: "Keep the search under 300 characters." }, { status: 400 });
  const includeWeb = searchParams.get("web") === "1";
  try {
    const [workspace, web] = await Promise.all([
      searchNovaWorkspace(profile, query),
      includeWeb ? searchWeb(query) : Promise.resolve([]),
    ]);
    return Response.json({ workspace, web });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Search failed." }, { status: 502 });
  }
}
