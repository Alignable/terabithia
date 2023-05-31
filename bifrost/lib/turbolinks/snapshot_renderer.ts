import { HeadDetails } from "./head_details";
import { Renderer, RenderDelegate, RenderCallback } from "./renderer";
import { Snapshot } from "./snapshot";
import { array, createScriptElement, focusFirstAutofocusableElement } from "./util";

export type PermanentElement = Element & { id: string };

export type Placeholder = {
  element: Element;
  permanentElement: PermanentElement;
};

type BodyRenderer = (body: string) => void;

const allHeadScriptsEverRun: { [outerHTML: string]: boolean } = {};
let firstLoad = true;

export class SnapshotRenderer extends Renderer {
  delegate?: RenderDelegate;
  readonly currentSnapshot: Snapshot;
  readonly currentHeadDetails: HeadDetails;
  readonly newSnapshot: Snapshot;
  readonly newHeadDetails: HeadDetails;
  readonly newBody: HTMLBodyElement;
  readonly isPreview: boolean;
  renderBody: BodyRenderer;

  // todo: dont need this?
  static render(
    delegate: RenderDelegate,
    callback: RenderCallback,
    currentSnapshot: Snapshot,
    newSnapshot: Snapshot,
    isPreview: boolean,
    renderBody: BodyRenderer
  ) {
    return new this(currentSnapshot, newSnapshot, isPreview, renderBody).render(
      delegate,
      callback
    );
  }

  constructor(
    currentSnapshot: Snapshot,
    newSnapshot: Snapshot,
    isPreview: boolean,
    renderBody: BodyRenderer
  ) {
    super();
    this.currentSnapshot = currentSnapshot;
    this.currentHeadDetails = currentSnapshot.headDetails;
    this.newSnapshot = newSnapshot;
    this.newHeadDetails = newSnapshot.headDetails;
    this.newBody = newSnapshot.bodyElement;
    this.isPreview = isPreview;
    this.renderBody = renderBody;
  }

  async render(delegate: RenderDelegate, callback: RenderCallback) {
    this.delegate = delegate;
    if (this.shouldRender()) {
      const scriptsLoaded = this.mergeHead();
      await this.renderView(async () => {
        this.replaceBody();
        await scriptsLoaded;
        callback();
      });
    } else {
      this.invalidateView();
    }
  }

  async mergeHead() {
    if (firstLoad) {
      // TODO: messy code
      for (const [outerHTML, details] of Object.entries(
        this.currentHeadDetails.detailsByOuterHTML
      )) {
        allHeadScriptsEverRun[outerHTML] = true;
      }
    }
    firstLoad = false;

    return new Promise<void>((resolve) => {
      this.copyNewHeadStylesheetElements();
      this.copyNewHeadScriptElements(resolve);
      this.removeCurrentHeadProvisionalElements();
      this.copyNewHeadProvisionalElements();
    });
  }

  replaceBody() {
    const placeholders = this.relocateCurrentBodyPermanentElements();
    this.renderBody(this.newBody.innerHTML);
    this.replacePlaceholderElementsWithClonedPermanentElements(placeholders);
  }

  shouldRender() {
    return this.newSnapshot.isVisitable() && this.trackedElementsAreIdentical();
  }

  trackedElementsAreIdentical() {
    return (
      this.currentHeadDetails.getTrackedElementSignature() ==
      this.newHeadDetails.getTrackedElementSignature()
    );
  }

  copyNewHeadStylesheetElements() {
    for (const element of this.getNewHeadStylesheetElements()) {
      document.head.appendChild(element);
    }
  }

  copyNewHeadScriptElements(onScriptsLoaded: () => void) {
    let blockingLoaded: boolean[] = [];
    const dispatch = () => {
      this.activateNewBodyScriptElements();
      focusFirstAutofocusableElement()

      onScriptsLoaded();
    };
    for (const element of this.getNewHeadScriptElements()) {
      const runBefore = element.outerHTML in allHeadScriptsEverRun;
      if (!runBefore) {
        let cb: false | (() => void) = false;
        if (!element.defer && element.src) {
          const idx = blockingLoaded.length;
          cb = () => {
            blockingLoaded[idx] = true;
            if (blockingLoaded.every((v) => v)) {
              dispatch();
            }
          };
          blockingLoaded.push(false);
        }
        const script = createScriptElement(element);
        if (cb) {
          console.log("added event");
          script.addEventListener("load", cb);
        }
        document.head.appendChild(script);
        allHeadScriptsEverRun[element.outerHTML] = true;
      }
    }
    if (blockingLoaded.length === 0) {
      // //TODO: raf waits for react to finish... not 100% sure of the reliability
      requestAnimationFrame(() => requestAnimationFrame(dispatch));
    }
  }

  removeCurrentHeadProvisionalElements() {
    for (const element of this.getCurrentHeadProvisionalElements()) {
      document.head.removeChild(element);
    }
  }

  copyNewHeadProvisionalElements() {
    for (const element of this.getNewHeadProvisionalElements()) {
      document.head.appendChild(element);
    }
  }

  relocateCurrentBodyPermanentElements() {
    return this.getCurrentBodyPermanentElements().reduce(
      (placeholders, permanentElement) => {
        const newElement = this.newSnapshot.getPermanentElementById(
          permanentElement.id
        );
        if (newElement) {
          const placeholder =
            createPlaceholderForPermanentElement(permanentElement);
          replaceElementWithElement(permanentElement, placeholder.element);
          replaceElementWithElement(newElement, permanentElement);
          return [...placeholders, placeholder];
        } else {
          return placeholders;
        }
      },
      [] as Placeholder[]
    );
  }

  replacePlaceholderElementsWithClonedPermanentElements(
    placeholders: Placeholder[]
  ) {
    for (const { element, permanentElement } of placeholders) {
      const clonedElement = permanentElement.cloneNode(true) as Element;
      replaceElementWithElement(element, clonedElement);
    }
  }

  activateNewBodyScriptElements() {
    for (const inertScriptElement of this.getNewBodyScriptElements()) {
      const activatedScriptElement = createScriptElement(inertScriptElement);
      replaceElementWithElement(inertScriptElement, activatedScriptElement);
    }
  }

  getNewHeadStylesheetElements() {
    return this.newHeadDetails.getStylesheetElementsNotInDetails(
      this.currentHeadDetails
    );
  }

  getNewHeadScriptElements() {
    return this.newHeadDetails.getScriptElementsNotInDetails(
      this.currentHeadDetails
    ) as HTMLScriptElement[];
  }

  getCurrentHeadProvisionalElements() {
    return this.currentHeadDetails.getProvisionalElements();
  }

  getNewHeadProvisionalElements() {
    return this.newHeadDetails.getProvisionalElements();
  }

  getCurrentBodyPermanentElements(): PermanentElement[] {
    return this.currentSnapshot.getPermanentElementsPresentInSnapshot(
      this.newSnapshot
    );
  }

  getNewBodyScriptElements() {
    return Array.from(
      document.body.querySelector("#proxied-body")!.querySelectorAll("script")
    );
  }
}

function createPlaceholderForPermanentElement(
  permanentElement: PermanentElement
) {
  const element = document.createElement("meta");
  element.setAttribute("name", "turbolinks-permanent-placeholder");
  element.setAttribute("content", permanentElement.id);
  return { element, permanentElement };
}

function replaceElementWithElement(fromElement: Element, toElement: Element) {
  const parentElement = fromElement.parentElement;
  if (parentElement) {
    return parentElement.replaceChild(toElement, fromElement);
  }
}
