import "server-only";

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
  source: string;
};

const MAX_RESULTS = 5;
const SEARCH_TIMEOUT_MS = 8_000;

function decodeHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#x27;|&#39;/g, "’")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function safePublicUrl(rawUrl: string): string | null {
  try {
    const decoded = rawUrl.startsWith("//") ? `https:${rawUrl}` : rawUrl;
    const redirect = new URL(decoded, "https://duckduckgo.com");
    const candidate = redirect.hostname.endsWith("duckduckgo.com") && redirect.searchParams.get("uddg")
      ? decodeURIComponent(redirect.searchParams.get("uddg") as string)
      : redirect.toString();
    const url = new URL(candidate);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "0.0.0.0" ||
      host === "127.0.0.1" ||
      host === "::1" ||
      host.endsWith(".local") ||
      /^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) return null;
    return url.toString();
  } catch {
    return null;
  }
}

async function braveSearch(query: string): Promise<WebSearchResult[]> {
  const key = process.env.BRAVE_SEARCH_API_KEY;
  if (!key) return [];
  const response = await fetch(
    `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${MAX_RESULTS}`,
    {
      headers: { Accept: "application/json", "X-Subscription-Token": key },
      cache: "no-store",
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    },
  );
  if (!response.ok) throw new Error(`Web search returned ${response.status}.`);
  const payload = await response.json() as {
    web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
  };
  return (payload.web?.results ?? []).flatMap((result) => {
    const url = safePublicUrl(result.url ?? "");
    if (!url) return [];
    return [{
      title: decodeHtml(result.title ?? "Untitled source"),
      url,
      snippet: decodeHtml(result.description ?? ""),
      source: new URL(url).hostname.replace(/^www\./, ""),
    }];
  }).slice(0, MAX_RESULTS);
}

async function duckDuckGoSearch(query: string): Promise<WebSearchResult[]> {
  const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: {
      Accept: "text/html",
      "User-Agent": "Mozilla/5.0 (compatible; GlaciaNav-Nova/1.0; +https://glacianav.com)",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Web search returned ${response.status}.`);
  const html = await response.text();
  const blocks = html.match(/<div[^>]+class="[^"]*result[^"]*"[\s\S]*?<\/div>\s*<\/div>/gi) ?? [];
  const results: WebSearchResult[] = [];
  for (const block of blocks) {
    const anchor = block.match(/<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    if (!anchor) continue;
    const url = safePublicUrl(anchor[1]);
    if (!url) continue;
    const snippet = block.match(/<(?:a|div)[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|div)>/i)?.[1] ?? "";
    results.push({
      title: decodeHtml(anchor[2]),
      url,
      snippet: decodeHtml(snippet),
      source: new URL(url).hostname.replace(/^www\./, ""),
    });
    if (results.length >= MAX_RESULTS) break;
  }
  return results;
}

export async function searchWeb(query: string): Promise<WebSearchResult[]> {
  const normalized = query.trim().replace(/\s+/g, " ").slice(0, 300);
  if (normalized.length < 2) return [];
  const brave = await braveSearch(normalized);
  return brave.length ? brave : duckDuckGoSearch(normalized);
}
