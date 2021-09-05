function createElement(name, attrs) {
  const el = document.createElement(name);
  for (const key in attrs) {
    if (key === "class") el.classList.add(...attrs[key].split(/\s+/));
    else if (key === "child") el.appendChild(attrs[key]);
    else if (key === "children")
      attrs[key].forEach((child) => el.appendChild(child));
    else if (key === "innerHTML") el.innerHTML = attrs[key];
    else if (key === "textContent") el.textContent = attrs[key];
    else if (key === "onClick") el.addEventListener("click", attrs[key]);
    else if (key === "selected") {
      // only create attribute if true
      attrs[key] && el.setAttribute(key, attrs[key]);
    } else el.setAttribute(key, attrs[key]);
  }
  return el;
}

function modal({
  child,
  children,
  innerHTML,
  onClose = () => {
    return;
  },
  closeText = "Close",
  onOk = null,
  okText = "Ok",
  useMousePosition,
  blocking = false,
}) {
  const div = createElement("div", { class: "modal" });
  if (innerHTML) div.innerHTML = innerHTML;
  if (child) div.appendChild(child);
  if (children) children.forEach((child) => div.appendChild(child));
  if (useMousePosition) setTopAndLeftToClick(div, useMousePosition);
  if (blocking) div.classList.add("centered");
  const blocker = blocking ? createElement("div", { class: "blocker" }) : null;
  const cleanup = () => {
    div.remove();
    blocker && blocker.remove();
  };
  const closeButton = createElement("button", {
    textContent: closeText,
    onClick: () => {
      onClose();
      cleanup();
    },
  });
  if (typeof onOk === "function") {
    const okButton = createElement("button", {
      textContent: okText,
      onClick: () => {
        onOk();
        cleanup();
      },
    });
    div.appendChild(okButton);
  }
  div.appendChild(closeButton);
  blocker && document.body.appendChild(blocker);
  return div;
}

function tipBox({ children, useMousePosition }) {
  const div = createElement("div", { class: "modal tipBox" });
  if (children) children.forEach((child) => div.appendChild(child));
  if (useMousePosition) setTopAndLeftToClick(div, useMousePosition);
  return div;
}

/**
 * Styles an element to be positioned at the mouse click, bounded by the
 * right and bottom edges of the window.
 *? Requires element to have position: absolute already set with CSS.
 *! You must attach the element to the DOM prior to calling this function
 *! or else the bounding rect properties will be all zeros.
 * @returns {HTMLElement}
 */
function setTopAndLeftToClick(htmlElement, { clientX, clientY } = {}) {
  const rect = htmlElement.getBoundingClientRect();
  const maxY = window.innerHeight - rect.height;
  const maxX = window.innerWidth - rect.width;
  htmlElement.style.top = (clientY < maxY ? clientY : maxY) + "px";
  htmlElement.style.left = (clientX < maxX ? clientX : maxX) + "px";
  return htmlElement;
}

function setStyle(key, value, ...htmlElements) {
  htmlElements.forEach((element) => {
    element.style[key] = value;
  });
}

function setHidden(...htmlElements) {
  setStyle("display", "none", ...htmlElements);
}

function setBlock(...htmlElements) {
  setStyle("display", "block", ...htmlElements);
}

function setInvisible(...htmlElements) {
  setStyle("visibility", "hidden", ...htmlElements);
}

function setVisible(...htmlElements) {
  setStyle("visibility", "visible", ...htmlElements);
}

function empty(el) {
  while (el && el.firstChild) el.removeChild(el.firstChild);
}

function remove(el) {
  if (typeof el === "string") el = document.querySelector(el);
  if (el) {
    empty(el);
    el.remove();
  }
}

export default {
  createElement,
  empty,
  modal,
  remove,
  setBlock,
  setHidden,
  setInvisible,
  setTopAndLeftToClick,
  setVisible,
  tipBox,
};
