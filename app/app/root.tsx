import { useMemo } from "react";
import {
  data,
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "react-router";
import { GrowthBook, GrowthBookProvider } from "@growthbook/growthbook-react";

import type { Route } from "./+types/root";
import {
  getGrowthBookPayload,
  getOrCreateAnonId,
} from "./lib/growthbook.server";
import "./app.css";

export async function loader({ request }: Route.LoaderArgs) {
  const { id, setCookieHeader } = await getOrCreateAnonId(request);
  const payload = await getGrowthBookPayload();
  // サーバーで評価した内容と同一のペイロード+属性をクライアントに渡し、
  // ハイドレーション時に同じバリアントを再現する(ちらつき・mismatch 防止)
  const attributes = { id };
  return data(
    { payload, attributes },
    setCookieHeader !== null
      ? { headers: { "Set-Cookie": setCookieHeader } }
      : undefined,
  );
}

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

// GA4 測定ID(公開情報なのでハードコードでOK)
const GA_MEASUREMENT_ID = "G-31LQ6H78ND";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script
          async
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}');`,
          }}
        />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const { payload, attributes } = useLoaderData<typeof loader>();

  // サーバーレンダリング時とクライアントハイドレーション時の両方で、
  // loader 由来の同じペイロード+属性から同期的にインスタンスを作る
  const gb = useMemo(() => {
    const instance = new GrowthBook({
      attributes,
      trackingCallback: (experiment, result) => {
        console.log(
          `[growthbook] exposure: ${experiment.key} -> variation ${result.key}`,
        );
        // GA4 への露出イベント送信(ブラウザのみ。サーバー側の評価はログのみ)。
        // gtag は head のインラインスクリプトで定義済みなので、ライブラリの
        // ロード前でも dataLayer にキューされて取りこぼしがない
        if (typeof window !== "undefined" && typeof window.gtag === "function") {
          window.gtag("event", "experiment_viewed", {
            experiment_id: experiment.key,
            variation_id: result.key,
            gb_anon_id: String(attributes.id),
          });
        }
      },
    });
    if (payload !== null) {
      instance.initSync({ payload: payload as never, streaming: false });
    }
    return instance;
  }, [payload, attributes]);

  return (
    <GrowthBookProvider growthbook={gb}>
      <Outlet />
    </GrowthBookProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
