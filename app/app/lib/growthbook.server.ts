import "dotenv/config";
import { createCookie } from "react-router";

const API_HOST = process.env.GB_API_HOST ?? "http://localhost:3100";
const CLIENT_KEY = process.env.GB_CLIENT_KEY ?? "";

// バケッティング用の匿名ID。サーバーで発行し、サーバー評価とクライアント評価の
// 両方で同じIDを使うことで「同じ人には常に同じバリアント」を保証する
export const anonIdCookie = createCookie("gb_anon_id", {
  maxAge: 60 * 60 * 24 * 365,
  sameSite: "lax",
  path: "/",
});

export async function getOrCreateAnonId(
  request: Request,
): Promise<{ id: string; setCookieHeader: string | null }> {
  const existing = await anonIdCookie.parse(request.headers.get("Cookie"));
  if (typeof existing === "string" && existing !== "") {
    return { id: existing, setCookieHeader: null };
  }
  const id = crypto.randomUUID();
  return { id, setCookieHeader: await anonIdCookie.serialize(id) };
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
