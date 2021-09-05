export default {
  clientToSVG,
  createElement,
  createPanArrow,
  getAggregateRectProps,
};

/**
 * @param {String} name name of the element to be returned
 * @param {Object} attributes to set on the DOMElement
 * @param {String} options
 * @returns DOMElement
 */
function createElement(name, attributes = {}, options = {}) {
  const svgEl = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const key in attributes) {
    if (key === "class") svgEl.classList.add(...attributes[key].split(/\s+/));
    else if (key === "child") svgEl.appendChild(attributes[key]);
    else if (key === "children")
      attributes[key].forEach((child) => svgEl.appendChild(child));
    else svgEl.setAttribute(key, attributes[key]);
  }
  if (options.innerHTML) svgEl.innerHTML = options.innerHTML;
  return svgEl;
}

/**
 * @param {"U"|"D"|"L"|"R"} direction
 */
function createPanArrow(direction) {
  return createElement("path", {
    id: `svg__pan${direction}`,
    d: getPanArrowDAttr(direction),
    fill: "none",
    stroke: "#666666",
    ["stroke-width"]: 3,
  });

  function getPanArrowDAttr(direction) {
    switch (direction) {
      case "U":
        return "M 5 10 L 12.5 2.5 L 20 10";
      case "D":
        return "M 5 10 L 12.5 17.5 L 20 10";
      case "L":
        return "M 12.5 2.5 L 5 10 L 12.5 17.5";
      case "R":
        return "M 12.5 2.5 L 20 10 L 12.5 17.5";
    }
  }
}

function getRectProps(svgRectElement) {
  return ["x", "y", "width", "height"].reduce((props, key) => {
    props[key] = Number(svgRectElement.getAttribute(key));
    return props;
  }, {});
}

/**
 * Loops through a list of rectangles, records the extrema, then returns
 * the minimal rectangle that includes all elements.
 */
function getAggregateRectProps(...svgRectElements) {
  const { x, y, x_, y_ } = svgRectElements.reduce(
    (borders, target) => {
      const { x, y, width, height } = getRectProps(target.nextSibling);
      if (x < borders.x) borders.x = x;
      if (x + width > borders.x_) borders.x_ = x + width;
      if (y < borders.y) borders.y = y;
      if (y + height > borders.y_) borders.y_ = y + height;
      return borders;
    },
    {
      x: Number.MAX_SAFE_INTEGER,
      y: Number.MAX_SAFE_INTEGER,
      x_: -Number.MAX_SAFE_INTEGER,
      y_: -Number.MAX_SAFE_INTEGER,
    }
  );
  return { x, y, width: x_ - x, height: y_ - y };
}

function clientToSVG(svg, { clientX, clientY }) {
  const point = svg.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  return point.matrixTransform(svg.getScreenCTM().inverse());
}
