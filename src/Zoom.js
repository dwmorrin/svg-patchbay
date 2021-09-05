import SVG from "./SVG";

let zoomCallback = () => undefined;

export default {
  into,
  out,
  pan,
  panTo,
  setOnZoom,
  setViewBox,
  showRect,
};

function into(svg, event = {}, zoomFactor = 2) {
  _zoom("in", svg, event, zoomFactor);
}

function out(svg, event = {}, zoomFactor = 2) {
  _zoom("out", svg, event, zoomFactor);
}

function _zoom(direction, svg, { clientX, clientY }, zoomFactor) {
  const z = direction === "out" ? zoomFactor : 1 / zoomFactor;
  if (clientX === undefined) clientX = window.innerWidth / 2;
  if (clientY === undefined) clientY = window.innerHeight / 2;
  const { x, y, width, height } = getViewBox(svg);
  const target = SVG.clientToSVG(svg, { clientX, clientY });
  const view = {
    x: newOrigin(target.x, z, x),
    y: newOrigin(target.y, z, y),
    width: width * z,
    height: height * z,
  };
  setViewBox(svg, view);
  zoomCallback(view);
}

/**
 * showRect takes into consideration how the current
 * dimensions of the svg appear (is it landscape or portrait?) and sizes the
 * view such that the specified rectangular area is completely in view.
 * It also imposes a minimum dimension to prevent zooming in too much on a small area.
 */
function showRect(svg, { x, y, width, height }) {
  const view = getViewBox(svg);
  const { width: width_, height: height_ } = calculateNewWidthAndHeight({
    width,
    height,
  });
  setViewBox(svg, {
    x: x + width / 2 - width_ / 2,
    y: y + height / 2 - height_ / 2,
    width: width_,
    height: height_,
  });
  function calculateNewWidthAndHeight({ width, height }) {
    const margin = 1.3;
    const minimum = 500;
    if (width < minimum && height < minimum) {
      if (width > height) {
        width = minimum;
      } else {
        height = minimum;
      }
    }
    return {
      width:
        width > height
          ? width * margin
          : (view.width * height * margin) / view.height,
      height:
        height >= width
          ? height * margin
          : (view.height * width * margin) / view.width,
    };
  }
}

/**
 * Formula to zoom while keeping an arbitrary point constant.
 * This calculates the new value for the first two SVG viewBox values.
 * @param {number} constant keeps this point in the same window coordinate
 * @param {number} zoomFactor >1 for "out" effect, <1 for "in" effect
 * @param {number} oldOrigin current origin value
 */
function newOrigin(constant, zoomFactor, oldOrigin) {
  return constant + zoomFactor * (oldOrigin - constant);
}

function pan(svg, { movementX, movementY }) {
  const { x, y, width, height } = getViewBox(svg);
  const panParser = parseWithScale(width / window.innerWidth);
  movementX = panParser(movementX, width);
  movementY = panParser(movementY, height);
  const view = {
    x: x - movementX,
    y: y - movementY,
    width,
    height,
  };
  setViewBox(svg, view);
  zoomCallback(view);
}

function panTo(svg, { x, y }) {
  const { width, height } = getViewBox(svg);
  const view = {
    x: x - width / 2,
    y: y - width / 2,
    width,
    height,
  };
  setViewBox(svg, view);
  zoomCallback(view);
}

/**
 * Allows panning to use "%" character to define a proportional movement
 * @param {Number|String} value
 * @param {Number} svgDimension
 * @param {Number} windowDimension
 */
function parseWithScale(scale) {
  return function (value, svgDimension) {
    if (typeof value === "string") {
      value = value.trim();
      if (value.endsWith("%")) {
        return svgDimension * Number(value.slice(0, value.length - 1)) * 0.01;
      } else value = Number(value);
    }
    if (typeof value === "number") return value * scale;
    throw `illegal pan command: ${value}`;
  };
}

function getViewBox(svg) {
  const viewBox = svg.getAttribute("viewBox").split(",").map(Number);
  return {
    x: viewBox[0],
    y: viewBox[1],
    width: viewBox[2],
    height: viewBox[3],
  };
}

function setViewBox(svg, { x, y, width, height }) {
  svg.setAttribute("viewBox", [x, y, width, height]);
}

function setOnZoom(cb) {
  zoomCallback = cb;
}
