import { Config } from "vite-plugin-ssr/types";
import onRenderClient from "@alignable/bifrost/renderer/onRenderClient";
import onRenderHtml from "@alignable/bifrost/renderer/onRenderHtml";
import onBeforeRoute from "@alignable/bifrost/renderer/onBeforeRoute";

export default {
  passToClient: [
    "layoutProps", "pageProps", "redirectTo", "documentProps",
  ],
  onRenderClient,
  onRenderHtml,
  onBeforeRoute,
  clientRouting: true,
  hydrationCanBeAborted: true,
  meta: {
    Layout: { env: "server-and-client" },
    layoutProps: {env: "server-and-client"},
    documentProps: { env: "server-and-client" },
  },
} satisfies Config;