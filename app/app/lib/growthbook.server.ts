import "dotenv/config";

const API_HOST = process.env.GB_API_HOST ?? "http://localhost:3100";
const CLIENT_KEY = process.env.GB_CLIENT_KEY ?? "";

// バケッティング用IDとして GA4 の client ID(_ga cookie)を共用する。
// GA4 の user_pseudo_id と同一になるため、BigQuery 上の露出データと
// SSR の割り当てが単一のIDで貫通する。
// 初回訪問時は _ga がまだ無いので、サーバー側で GA と同じ形式
// (GA1.1.<乱数>.<unix秒> / client ID は後半2セグメント)で発行する。
// gtag.js は既存の _ga cookie をそのまま採用する仕様なので、
// このIDがそのまま GA4 の client ID になる
export function parseGaClientId(cookieHeader: string | null): string | null {
  const m = cookieHeader?.match(/(?:^|;\s*)_ga=([^;]+)/);
  if (!m) return null;
  // 形式: GA1.1.1234567890.1234567890 → client ID は「1234567890.1234567890」
  const parts = m[1].split(".");
  if (parts.length < 4) return null;
  return parts.slice(-2).join(".");
}

export async function getOrCreateAnonId(
  request: Request,
): Promise<{ id: string; setCookieHeader: string | null }> {
  const existing = parseGaClientId(request.headers.get("Cookie"));
  if (existing !== null) {
    return { id: existing, setCookieHeader: null };
  }
  const rand = Math.floor(Math.random() * 1_000_000_000) + 1_000_000_000;
  const id = `${rand}.${Math.floor(Date.now() / 1000)}`;
  const setCookieHeader = `_ga=GA1.1.${id}; Max-Age=63072000; Path=/; SameSite=Lax`;
  return { id, setCookieHeader };
}

// SDKペイロード(feature定義)はプロセス内でキャッシュし、
// リクエスト毎に GrowthBook API を叩かない
let cache: { payload: unknown; fetchedAt: number } | null = null;
const TTL_MS = 30_000;

export async function getGrowthBookPayload(): Promise<unknown | null> {
  if (CLIENT_KEY === "") {
    console.warn(
      "[growthbook] GB_CLIENT_KEY is not set. Features will use fallback values. See README.",
    );
    return null;
  }
  if (cache !== null && Date.now() - cache.fetchedAt < TTL_MS) {
    return cache.payload;
  }
  try {
    const res = await fetch(`${API_HOST}/api/features/${CLIENT_KEY}`);
    if (!res.ok) {
      throw new Error(`GrowthBook API responded ${res.status}`);
    }
    const payload = await res.json();
    cache = { payload, fetchedAt: Date.now() };
    return payload;
  } catch (e) {
    console.error("[growthbook] failed to fetch SDK payload:", e);
    // 取得失敗時は古いキャッシュがあればそれを使う(なければフォールバック値で描画)
    return cache?.payload ?? null;
  }
}
