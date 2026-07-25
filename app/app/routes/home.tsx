import {
  useFeatureIsOn,
  useFeatureValue,
} from "@growthbook/growthbook-react";
import { useRouteLoaderData } from "react-router";
import type { Route } from "./+types/home";
import type { loader as rootLoader } from "../root";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "GrowthBook SSR Lab" },
    { name: "description", content: "GrowthBook + React Router SSR A/B testing lab" },
  ];
}

export default function Home() {
  const rootData = useRouteLoaderData<typeof rootLoader>("root");

  // GrowthBook 側でこのキーの feature を作ると出し分けが動く。
  // 未作成・未接続の間はフォールバック値で描画される
  const bannerOn = useFeatureIsOn("demo-banner");
  const bannerText = useFeatureValue(
    "demo-banner-text",
    "(fallback) demo-banner-text 未設定です",
  );

  return (
    <main style={{ fontFamily: "sans-serif", maxWidth: 640, margin: "4rem auto" }}>
      <h1>GrowthBook SSR Lab</h1>

      {bannerOn ? (
        <div
          style={{
            padding: "1rem",
            borderRadius: 8,
            background: "#e0f2fe",
            border: "1px solid #0284c7",
          }}
        >
          <strong>demo-banner: ON</strong>
          <p>{bannerText}</p>
        </div>
      ) : (
        <div
          style={{
            padding: "1rem",
            borderRadius: 8,
            background: "#f3f4f6",
            border: "1px solid #9ca3af",
          }}
        >
          demo-banner: OFF(または GrowthBook 未接続)
        </div>
      )}

      <h2>デバッグ情報</h2>
      <ul>
        <li>
          匿名ID(cookie: gb_anon_id): <code>{rootData?.attributes.id}</code>
        </li>
        <li>
          SDKペイロード: {rootData?.payload !== null ? "取得済み" : "未接続(フォールバック動作)"}
        </li>
      </ul>
      <p>
        このページはSSRで評価済みのバリアントがそのままハイドレートされるため、
        リロードしてもちらつきは発生しません。実験の露出ログはブラウザとサーバー両方の
        コンソールに <code>[growthbook] exposure:</code> として出力されます。
      </p>
    </main>
  );
}
