// 1訪問して、画面に表示されたバケッティングID(=GA client ID)を取得する
import { chromium } from "playwright";

const browser = await chromium.launch({ channel: "chrome-canary", headless: false });
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto("http://localhost:5173/", { waitUntil: "load", timeout: 15000 });
const id = (await page.textContent("code")) ?? "";
await page.waitForTimeout(3000); // gtag のビーコン送信待ち
await ctx.close();
await browser.close();
console.log(id.trim());
