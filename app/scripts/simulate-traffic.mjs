// GA4 にテストデータを溜めるためのトラフィックシミュレータ。
// 毎回まっさらなブラウザコンテキスト(=新規ユーザー)で訪問し、
// パターンAは70%・Bは30%の確率でCTAをクリックする。
// この差が GrowthBook の実験結果で「Aの勝ち」として検出されるはず。
//
// 使い方: node scripts/simulate-traffic.mjs [訪問数] [URL]
import { chromium } from "playwright";

const N = Number.parseInt(process.argv[2] ?? "40", 10);
const URL = process.argv[3] ?? "http://localhost:5173/";
const CLICK_PROB = { A: 0.7, B: 0.3 };

// Chrome Canary を使用(Playwright の自動化用プロファイルで起動するので、
// 普段の Canary のプロファイルや履歴には影響しない)。
// ヘッドレスだと UA が HeadlessChrome になり GA4 のボットフィルタに
// 落とされるため、ヘッドあり(ウィンドウ表示)で起動する
const browser = await chromium.launch({
  channel: "chrome-canary",
  headless: false,
});
const counts = { A: 0, B: 0, unknown: 0, clicks: { A: 0, B: 0 } };

for (let i = 0; i < N; i++) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  try {
    await page.goto(URL, { waitUntil: "load", timeout: 15000 });
    const text = (await page.textContent("main")) ?? "";
    const variant = text.includes("パターンA")
      ? "A"
      : text.includes("パターンB")
        ? "B"
        : "unknown";
    counts[variant]++;

    let clicked = false;
    if (variant !== "unknown" && Math.random() < CLICK_PROB[variant]) {
      await page.click("#demo-cta", { timeout: 3000 }).catch(() => {});
      counts.clicks[variant]++;
      clicked = true;
    }
    // gtag のビーコン送信を待ってからコンテキストを閉じる
    await page.waitForTimeout(2000);
    console.log(`${i + 1}/${N} variant=${variant}${clicked ? " +click" : ""}`);
  } catch (e) {
    counts.unknown++;
    console.log(`${i + 1}/${N} error: ${e.message}`);
  } finally {
    await ctx.close();
  }
}

await browser.close();
console.log("\nresult:", JSON.stringify(counts, null, 2));
