export function copyElementAttributes(
  destinationElement: Element,
  sourceElement: Element
) {
  for (const { name, value } of Array.from(sourceElement.attributes)) {
    destinationElement.setAttribute(name, value);
  }
}

export function createScriptElement(element: Element, cb?: () => void) {
  if (element.getAttribute("data-turbolinks-eval") == "false") {
    return element;
  } else {
    const createdScriptElement = document.createElement("script");
    createdScriptElement.textContent = element.textContent;
    // async false makes scripts run in-order. it wont block js execution (thankfully)
    //   https://github.com/turbolinks/turbolinks/issues/282#issuecomment-355731712
    createdScriptElement.async = false;
    copyElementAttributes(createdScriptElement, element);
    if (cb) {
      createdScriptElement.addEventListener("load", cb);
    }
    return createdScriptElement;
  }
}

function replaceElementWithElement(fromElement: Element, toElement: Element) {
  const parentElement = fromElement.parentElement;
  if (parentElement) {
    return parentElement.replaceChild(toElement, fromElement);
  }
}
export function activateNewBodyScriptElements(
  newScriptElements: HTMLScriptElement[]
) {
  for (const inertScriptElement of newScriptElements) {
    const activatedScriptElement = createScriptElement(inertScriptElement);
    replaceElementWithElement(inertScriptElement, activatedScriptElement);
  }
}

export function getElementAttributes(element: Element) {
  const bodyAttrs: Record<string, string> = {};
  element.getAttributeNames().forEach((name) => {
    bodyAttrs[name] = element.getAttribute(name)!;
  });
  return bodyAttrs;
}

export function escapeHtml(unsafeString: string): string {
  // Source: https://stackoverflow.com/questions/6234773/can-i-escape-html-special-chars-in-javascript/6234804#6234804
  const safe = unsafeString
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
  return safe;
}
