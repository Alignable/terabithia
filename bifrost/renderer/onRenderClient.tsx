import React, { PropsWithChildren } from "react";
import { renderReact } from "../lib/renderReact.js";
import { PageContextNoProxyClient } from "../types/internal.js";
import { PageShell } from "../lib/PageShell.js";
import { Turbolinks } from "../lib/turbolinks/index.js";
import { buildHead } from "./utils/buildHead.js";

Turbolinks.start();

const PassThruLayout: React.ComponentType<PropsWithChildren> = ({
  children,
}) => <>{children}</>;

export default async function onRenderClient(
  pageContext: PageContextNoProxyClient
) {
  if (pageContext.redirectTo) {
    Turbolinks.visit(pageContext.redirectTo);
    return;
  }

  const { Page, pageProps } = pageContext;
  const { Layout = PassThruLayout, layoutProps } = pageContext.config;

  if (!Page)
    throw new Error("Client-side render() hook expects Page to be exported");

  const page = (
    <PageShell pageContext={pageContext}>
      <Layout {...layoutProps}>
        <Page {...pageProps} />
      </Layout>
    </PageShell>
  );
  if (pageContext.isHydration) {
    // During hydration of initial ssr, body is in dom, not page props (to avoid double-send)
    renderReact(page, pageContext.isHydration);
  } else {
    // clear anything on body
    document.body
      .getAttributeNames()
      .forEach((n) => document.body.removeAttribute(n));

    const head = document.createElement("head");
    head.innerHTML = buildHead(pageContext); //TODO: this is not safe
    Turbolinks._vpsOnRenderClient(head, false, () => {
      renderReact(page, pageContext.isHydration);
    });
    // Turbolinks._vpsOnRenderClient(async () => {
    //   const { title = "", description = "" } = getDocumentProps(pageContext);
    //   document.title = title;
    //   document.head
    //     .querySelector("meta[name='description']")
    //     ?.setAttribute("content", description);

    //   renderReact(page, pageContext.isHydration);
    // });
  }
}
