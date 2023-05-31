import React from "react";
import ReactDOMServer from "react-dom/server";
import { dangerouslySkipEscape, escapeInject } from "vite-plugin-ssr/server";
import { PageContextProxyServer } from "../../types/internal.js";
import { PageShell } from "../../lib/PageShell.js";
import jsdom from "jsdom";

export default async function onRenderHtml(
  pageContext: PageContextProxyServer
) {
  if (pageContext.proxy) {
    const { proxy, layoutProps, layout } = pageContext;

    const dom = new jsdom.JSDOM(proxy);
    const doc = dom.window.document;
    const bodyEl = doc.querySelector("body");
    const head = doc.querySelector("head");
    if (!bodyEl || !head) {
      throw new Error("Proxy failed");
    }

    // disable vite-plugin-ssr link interceptor. May not be neccessary in future:
    // https://github.com/brillout/vite-plugin-ssr/discussions/728#discussioncomment-5634111
    bodyEl
      .querySelectorAll("a[rel='external']")
      .forEach((e) => e.setAttribute("data-turbolinks", "false"));
    bodyEl.querySelectorAll("a").forEach((e) => (e.rel = "external"));

    const bodyAttrs: Record<string, string> = {};
    bodyEl.getAttributeNames().forEach((name) => {
      bodyAttrs[name] = bodyEl.getAttribute(name)!;
    });

    const Layout = pageContext.config.layoutMap[layout];
    if (!Layout) throw new Error(`${layout} layout not found`);
    const pageHtml = ReactDOMServer.renderToString(
      <PageShell pageContext={pageContext}>
        <Layout {...layoutProps}>
          <div
            id="proxied-body"
            dangerouslySetInnerHTML={{ __html: bodyEl.innerHTML }}
          />
        </Layout>
      </PageShell>
    );

    const documentHtml = escapeInject`
    <!DOCTYPE html>
    <html>
        <head>
          ${dangerouslySkipEscape(head.innerHTML)}
          ${
            // We need to fire turbolinks:load exactly on DCL, so it must be a blocking head script to catch DCL event.
            // Vite loads scripts with type="module" so the rest of our code will show up too late.
            // TODO: figure out how to bundle this better. at least read from a .js file
            dangerouslySkipEscape(`<script>
      console.log('resetting turb')
          window.Turbolinks = {controller:{restorationIdentifier: ''}};
          addEventListener("DOMContentLoaded", () => {
            const event = new Event("turbolinks:load", { bubbles: true, cancelable: true });
            event.data = {url: window.location.href};
            document.dispatchEvent(event);  
          })
          </script>`)
          }
        </head>
        <body ${dangerouslySkipEscape(
          Object.entries(bodyAttrs)
            .map(([name, value]) => `${name}="${value}"`)
            .join(" ")
        )}>
          <div id="page-view">${dangerouslySkipEscape(pageHtml)}</div>
        </body>
    </html>`;

    return {
      documentHtml,
      pageContext: {},
    };
  } else {
    // do nothing: Just exists to signal fastify server that no routes matched and we should proxy
    return {};
  }
}
