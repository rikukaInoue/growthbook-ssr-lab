# growthbook-ssr-lab

GrowthBook(セルフホスト)+ React Router v7(SSR)で A/B テストを試す個人検証用リポジトリ。

## 構成

- `docker-compose.yml` — GrowthBook 本体 + MongoDB(localhost のみに bind)
- `app/` — React Router v7(framework mode, SSR)+ `@growthbook/growthbook-react`

SSR のポイント:

- feature 定義(SDKペイロード)は **サーバー側で取得しプロセス内キャッシュ**(TTL 30秒)
- バケッティング用の**匿名IDをサーバーで cookie 発行**し、サーバー/クライアント両方で同じ属性を使用
- loader 経由で **同一ペイロード+属性をクライアントへ渡してハイドレート** → バリアントのちらつき(flicker)なし
- GrowthBook 未接続でもフォールバック値で普通に動く(fail-open)

## セットアップ

### 1. GrowthBook を用意(Cloud または セルフホスト)

**Cloud(推奨・手軽)**: https://app.growthbook.io でアカウント作成(スタータープランは無料)。docker compose は不要。

**セルフホスト**: ローカルで完結させたい場合はこちら。

```shell
docker compose up -d
```

http://localhost:3000 を開き、初回の管理者アカウントを作成する。

### 2. SDK Connection を作成して Client Key を取得

管理画面: **SDK Configuration → SDK Connections → Add SDK Connection**(言語は JavaScript / React)。
発行された `sdk-...` の Client Key をコピー。

```shell
cd app
cp .env.example .env
# .env の GB_CLIENT_KEY に Client Key を貼り付ける
# GB_API_HOST は Cloud なら https://cdn.growthbook.io(.env.example のデフォルト)、
# セルフホストなら http://localhost:3100 にする
```

### 3. feature を作る

管理画面: **Features → Add Feature**

| Key | Type | 用途 |
|---|---|---|
| `demo-banner` | boolean | バナーの ON/OFF |
| `demo-banner-text` | string | バナー文言(Experiment ルールを付けて A/B テストにする) |

A/B テストにするには feature に **Experiment ルール**を追加(assign は attribute `id`、split 50/50 など)。

### 4. アプリを起動

```shell
cd app
npm install
npm run dev
```

http://localhost:5173 で確認。実験の露出ログはブラウザ/サーバー両方のコンソールに `[growthbook] exposure:` として出る。

## 動作確認のポイント

- リロードしてもバリアントが変わらない(cookie の匿名IDで固定)
- 初期描画からバリアントが確定していて、ちらつかない(SSR評価→同一状態でハイドレート)
- cookie `gb_anon_id` を消すと再抽選される
- GrowthBook 側で feature を変更すると、キャッシュTTL(30秒)経過後に反映される

## 計測(GA4)

`trackingCallback` からブラウザ側で GA4 に `experiment_viewed` イベントを送信する
(パラメータ: `experiment_id`, `variation_id`, `gb_anon_id`)。gtag スニペットは
`root.tsx` の Layout に埋め込み済み(測定ID: G-31LQ6H78ND)。

- 受信確認: GA4 管理画面の **Realtime** または **DebugView**(`?gtm_debug=x` を付けてアクセス)
- サーバー側評価の露出はコンソールログのみ(二重計上防止。ブラウザでのハイドレーション時に必ず同じ評価が走るため、送信はブラウザ側に寄せている)

## 次のステップ(未実装)

- GrowthBook にデータソース(GA4 は BigQuery export 経由)とメトリクスを設定して実験結果を可視化
- Sticky bucketing / Streaming(SSE)での即時反映
