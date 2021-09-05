var Patchbay = (function () {
  'use strict';

  var SVG = {
    clientToSVG,
    createElement: createElement$1,
    createPanArrow,
    getAggregateRectProps,
  };

  /**
   * @param {String} name name of the element to be returned
   * @param {Object} attributes to set on the DOMElement
   * @param {String} options
   * @returns DOMElement
   */
  function createElement$1(name, attributes = {}, options = {}) {
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
    return createElement$1("path", {
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

  class PatchCable {
    static defaultLength = 300;
    constructor(parent, color) {
      this.parent = parent;
      this.x = 0;
      this.y = 0;
      this.color = color || "#ff0000";
      this.start; // first patchpoint
      this.end; // second patchpoint
      this.path; // cable <path> element
      this.startX = 0;
      this.startY = 0;
      this.qX = 0;
      this.qY = 0;
      this.stopX = 0;
      this.stopY = 0;
      this.danglingStart = false;
      this.danglingEnd = false;
      this.clone;
    }

    getDAttr() {
      return `M${this.startX},${this.startY} Q${this.qX},${this.qY} ${this.stopX},${this.stopY}`;
    }

    drawPatch(circle, type) {
      circle.setAttribute("patched", true);
      circle.setAttribute("fill", this.color);
      if (type === "start") {
        this.startX = Number(circle.getAttribute("cx"));
        this.stopX = this.startX;
        this.startY = Number(circle.getAttribute("cy"));
        this.stopY = this.startY;
        this.qX = this.startX;
        this.qY = this.startY + PatchCable.defaultLength / 2;
        this.path = SVG.createElement("path", {
          d: this.getDAttr(),
          fill: "none",
          stroke: this.color,
          "stroke-width": 20,
          "stroke-opacity": 0.8,
          "stroke-linecap": "round",
          patched: true,
        });
        this.parent.appendChild(this.path);
        this.start = circle;
        const overview = document.getElementById("overview");
        this.clone = this.path.cloneNode();
        overview.appendChild(this.clone);
        this.swing({
          massFactor: 0.1,
          keyToAnimate: "stopX",
          finalValue: this.startX,
          keyFlag: "danglingStart",
        });
        this.drop({
          massFactor: 1,
          keyToAnimate: "stopY",
          finalValue: this.startY + PatchCable.defaultLength,
          keyFlag: "danglingStart",
        });
      } else if (type === "end") {
        this.danglingStart = false;
        this.stopX = +circle.getAttribute("cx");
        this.stopY = +circle.getAttribute("cy");
        this.qX =
          this.stopX > this.startX
            ? (this.stopX - this.startX) / 2 + this.startX
            : (this.startX - this.stopX) / 2 + this.stopX;
        this.qY = this.startY > this.stopY ? this.startY : this.stopY;
        this.path.setAttribute(
          "d",
          `M${this.startX},${this.startY} Q${this.qX},${this.qY} ${this.stopX},${this.stopY}`
        );
        this.end = circle;
        this.swing({
          massFactor: 0.2,
          keyToAnimate: "qX",
          finalValue: (this.startX + this.stopX) / 2,
          keyFlag: "danglingEnd",
        });
        this.drop({
          massFactor: 1,
          keyToAnimate: "qY",
          finalValue:
            (this.stopY > this.startY ? this.stopY : this.startY) +
            PatchCable.defaultLength,
          keyFlag: "danglingEnd",
        });
      }
    }

    drop({ massFactor, keyToAnimate, finalValue, keyFlag }) {
      const acceleration = 2;
      let speed = 0;
      const animation = () => {
        if (!this[keyFlag]) return;
        speed += acceleration * massFactor;
        this[keyToAnimate] += speed;
        this.path.setAttribute("d", this.getDAttr());
        if (this[keyToAnimate] < finalValue)
          window.requestAnimationFrame(animation);
        else {
          this[keyToAnimate] = finalValue;
          this.path.setAttribute("d", this.getDAttr());
        }
      };
      this[keyFlag] = true;
      window.requestAnimationFrame(animation);
    }

    swing({ massFactor, keyToAnimate, finalValue, keyFlag }) {
      let frame = 0,
        maxSwing = 50;
      this[keyToAnimate] -= maxSwing * Math.E;
      const animation = () => {
        if (!this[keyFlag]) return;
        const t = frame / (2 * Math.PI);
        this[keyToAnimate] =
          finalValue + maxSwing * Math.sin(t) * Math.exp(-t * massFactor);
        this.path.setAttribute("d", this.getDAttr());
        ++frame;
        if (frame < 200) window.requestAnimationFrame(animation);
        else if (Math.abs(this.startX - this.stopX) < 5) {
          // avoid abrupt transition
          this[keyToAnimate] = finalValue;
          this.path.setAttribute("d", this.getDAttr());
        }
      };
      this[keyFlag] = true;
      window.requestAnimationFrame(animation);
    }

    clearPatch() {
      this.danglingStart = false;
      this.danglingEnd = false;
      const resetPatchPoints = (el) => {
        if (el) {
          el.setAttribute("fill", "black");
          el.setAttribute("patched", false);
        }
      };
      [this.start, this.end].forEach(resetPatchPoints);
      this.path.remove();
      this.clone && this.clone.remove();
    }

    move({ movementX, movementY }) {
      this.danglingStart = false;
      this.danglingEnd = false;
      this[!this.end ? "stopX" : "qX"] += movementX;
      this[!this.end ? "stopY" : "qY"] += movementY;
      [this.path, this.clone].forEach((el) =>
        el.setAttribute("d", this.getDAttr())
      );
    }
  }

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

  var HTML = {
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

  /**
   * public width
   * public element
   * public editForm
   * public static readEditForm
   */
  class PatchGroup {
    static colWidth = 50;
    static rowHeight = 100;
    static r = 20;
    constructor({
      x = 0,
      y = 0,
      row = 1,
      group = 1,
      name = "",
      span = 1,
      color = "white",
      enumeration = [],
      description = "",
      normals = "",
      tags = [],
    }) {
      this.x = x;
      this.y = y;
      this.row = Number(row);
      this.group = Number(group);
      name = String(name);
      this.milSize = Number(name.startsWith("^"));
      this.hiddenName = name.startsWith("*");
      this.space = name.startsWith("$");
      this.name = name.replace(/^[*$^]/, "");
      this.span = Number(span);
      this.color = String(color);
      this.enumeration = enumeration;
      this.description = String(description);
      this.normals = String(normals);
      this.tags = tags;
    }

    /**
     * Users just read the result at public property editForm.
     *! Any changes to this function must be reflected in the readEditForm function.
     */
    createEditForm() {
      const form = HTML.createElement("form");
      form.classList.add("patchGroupEdit");
      for (const key of [
        "name",
        "description",
        "row",
        "group",
        "span",
        "enumeration",
        "tags",
        "color",
      ]) {
        const capitalized = key.charAt(0).toUpperCase() + key.slice(1);
        const id = `patchGroupEdit${capitalized}`;
        form.appendChild(
          HTML.createElement("label", {
            textContent: capitalized,
            for: id,
          })
        );
        form.appendChild(
          HTML.createElement("input", {
            type: "text",
            name: key,
            id,
            value: ["enumeration", "tags"].includes(key)
              ? this[key].join(",")
              : this[key],
          })
        );
      }
      const id = "patchGroupEditNormals";
      form.appendChild(
        HTML.createElement("label", {
          textContent: "Normals",
          for: id,
        })
      );
      form.appendChild(
        HTML.createElement("select", {
          id,
          children: ["", "ABOVE", "BELOW", "RIGHT OUT", "RIGHT IN"].map((value) =>
            HTML.createElement("option", {
              value,
              textContent: value,
              selected: this.normals === value,
            })
          ),
        })
      );
      this.editForm = form;
      return this;
    }

    static readEditForm(form) {
      const result = Array.from(form.querySelectorAll("input")).reduce(
        (result, { name, value }) => {
          return {
            ...result,
            [name]: ["enumeration", "tags"].includes(name)
              ? value.split(",")
              : value,
          };
        },
        {}
      );
      result.normals = form.querySelector("select").value;
      return result;
    }

    createElement() {
      const columnWidth =
        PatchGroup.colWidth + this.milSize * PatchGroup.colWidth * 0.3333;
      this.width = columnWidth * this.span;

      this.element = SVG.createElement("g", {
        children: [
          SVG.createElement("rect", {
            x: this.x,
            y: this.y,
            width: this.width,
            height: PatchGroup.rowHeight / 2,
            stroke: "black",
            fill: this.color,
            class: "noEvent",
          }),
          SVG.createElement("rect", {
            x: this.x,
            y: this.y + PatchGroup.rowHeight / 2,
            width: this.width,
            height: PatchGroup.rowHeight / 2,
            stroke: "black",
            fill: "grey",
          }),
        ],
      });

      if (!this.space) {
        this.element.appendChild(
          SVG.createElement(
            "text",
            {
              x: this.x - this.name.length * 3 + this.width / 2,
              y: this.y + PatchGroup.r,
              "font-family": "Arial",
              "font-size": 12,
              class: "noEvent",
              tags: this.tags,
              desc: this.description,
              fill: this.hiddenName ? this.color : "black",
            },
            { innerHTML: this.name }
          )
        );
        this.element.appendChild(
          SVG.createElement("rect", {
            x: this.x,
            y: this.y,
            width: this.width,
            height: PatchGroup.rowHeight / 2,
            class: this.name ? "patchGroup" : "blank",
            "fill-opacity": 0,
            desc: this.description,
            id: this.row + "," + this.group,
          })
        );
      }

      const isSeries =
        this.enumeration.length === 1 &&
        this.enumeration[0] !== "" &&
        !isNaN(+this.enumeration[0]);
      Array.from({ length: this.span })
        .map((_, i) => i)
        .forEach((column) => {
          const _x = this.x + columnWidth * column;
          const label = isSeries
            ? String(column + Number(this.enumeration[0]))
            : this.enumeration[column] || "";
          if (!this.space) {
            this.element.appendChild(
              SVG.createElement(
                "text",
                {
                  x: _x + 1.25 * PatchGroup.r - label.length * 3,
                  y: this.y + 2 * PatchGroup.r,
                  "font-family": "Arial",
                  "font-size": 12,
                  class: "noEvent",
                },
                {
                  innerHTML: label,
                }
              )
            );
            this.element.appendChild(
              SVG.createElement("circle", {
                class: "patchPoint",
                cx:
                  _x + 1.25 * PatchGroup.r + this.milSize * PatchGroup.r * 0.3333,
                cy: this.y + PatchGroup.rowHeight - PatchGroup.r * 1.25,
                r: PatchGroup.r + this.milSize * PatchGroup.r * 0.15,
                id: `cir${this.row}-${this.group}-${column}`,
                patched: false,
              })
            );
            if (this.normals) {
              this.element.appendChild(this.makeArrow(this.normals, _x, this.y));
            }
          }
        });
      return this;
    }

    arrowPoints(type, x, y) {
      const makePolygonString = (...points) =>
        points.map(([x, y]) => `${x},${y}`).join(" ");
      switch (type) {
        case "BELOW":
          return makePolygonString(
            [x + PatchGroup.r, y + PatchGroup.rowHeight - PatchGroup.r * 1.25],
            [
              x + 1.5 * PatchGroup.r,
              y + PatchGroup.rowHeight - PatchGroup.r * 1.25,
            ],
            [
              x + 1.5 * PatchGroup.r,
              y + PatchGroup.rowHeight - PatchGroup.r * 0.75,
            ],
            [
              x + 2.0 * PatchGroup.r,
              y + PatchGroup.rowHeight - PatchGroup.r * 0.75,
            ],
            [x + 1.25 * PatchGroup.r, y + PatchGroup.rowHeight],
            [
              x + 0.5 * PatchGroup.r,
              y + PatchGroup.rowHeight - PatchGroup.r * 0.75,
            ],
            [x + PatchGroup.r, y + PatchGroup.rowHeight - PatchGroup.r * 0.75]
          );
        case "ABOVE":
          return makePolygonString(
            [x + PatchGroup.r, y - PatchGroup.rowHeight * 0.25],
            [x + 1.5 * PatchGroup.r, y - PatchGroup.rowHeight * 0.25],
            [
              x + 1.5 * PatchGroup.r,
              y - PatchGroup.rowHeight * 0.25 + PatchGroup.r * 0.5,
            ],
            [
              x + 2.0 * PatchGroup.r,
              y - PatchGroup.rowHeight * 0.25 + PatchGroup.r * 0.5,
            ],
            [x + 1.25 * PatchGroup.r, y],
            [
              x + 0.5 * PatchGroup.r,
              y - PatchGroup.rowHeight * 0.25 + PatchGroup.r * 0.5,
            ],
            [
              x + PatchGroup.r,
              y - PatchGroup.rowHeight * 0.25 + PatchGroup.r * 0.5,
            ]
          );
        case "RIGHT OUT":
          return makePolygonString(
            [x + 25, y + 75],
            [x + 35, y + 75],
            [x + 35, y + 65],
            [x + 50, y + 80],
            [x + 35, y + 95],
            [x + 35, y + 85],
            [x + 25, y + 85]
          );
        case "RIGHT IN":
          return makePolygonString(
            [x, y + 75],
            [x + 10, y + 75],
            [x + 10, y + 65],
            [x + 25, y + 80],
            [x + 10, y + 95],
            [x + 10, y + 85],
            [x, y + 85]
          );
      }
    }
    makeArrow(type, x, y) {
      return SVG.createElement("polygon", {
        points: this.arrowPoints(type, x, y),
        fill: "white",
        class: "noEvent normals",
      });
    }
  }

  /*!
   * Deep merge two or more objects together.
   * (c) 2019 Chris Ferdinandi, MIT License, https://gomakethings.com
   * @param   {Object}   objects  The objects to merge together
   * @returns {Object}            Merged values of defaults and options
   */

  const deepMerge = function () {
    // Setup merged object
    var newObj = {};

    // Merge the object into the newObj object
    var merge = function (obj) {
      for (var prop in obj) {
        if (obj.hasOwnProperty(prop)) {
          // If property is an object, merge properties
          if (Object.prototype.toString.call(obj[prop]) === "[object Object]") {
            newObj[prop] = deepMerge(newObj[prop], obj[prop]);
          } else {
            newObj[prop] = obj[prop];
          }
        }
      }
    };

    // Loop through each object and conduct a merge
    for (var i = 0; i < arguments.length; i++) {
      merge(arguments[i]);
    }

    return newObj;
  };

  const buttons = { left: 0, right: 2 };
  const wait$1 = { doubleClick: 300, drag: 40, wheel: 125 };
  const state$1 = {
    down: false,
    dragTimeoutId: 0,
    dragging: false,
    singleClickTimeoutId: 0,
    wheel: 0,
    wheelTimeoutId: 0,
  };

  let transitions$1 = {
    onClick: {
      single: {
        left: () => undefined,
        right: () => undefined,
      },
      double: {
        left: () => undefined,
        right: () => undefined,
      },
    },
    onDown: {
      left: () => undefined,
      right: () => undefined,
    },
    onDrag: () => undefined,
    onDragEnd: () => undefined,
    onMove: () => undefined,
    onUp: {
      left: () => undefined,
      right: () => undefined,
    },
    onWheel: () => undefined,
  };

  var Mouse = {
    listenOn: listenOn$1,
    setTransitions: setTransitions$1,
    withMouseState,
  };

  function listenOn$1(element = window) {
    element.addEventListener("mousemove", (event) => {
      if (state$1.down) transitions$1.onDrag({ event, state: state$1, setState: setState$1 });
      else transitions$1.onMove({ event, state: state$1, setState: setState$1 });
    });

    element.addEventListener("mousedown", (event) => {
      state$1.dragTimeoutId = window.setTimeout(() => {
        state$1.dragTimeoutId = 0;
        state$1.down = true;
      }, wait$1.drag);
      if (event.button === buttons.left)
        transitions$1.onDown.left({ event, state: state$1, setState: setState$1 });
      if (event.button === buttons.right)
        transitions$1.onDown.right({ event, state: state$1, setState: setState$1 });
    });

    // re-creates logic to detect "click" and "double click" events
    element.addEventListener("mouseup", (event) => {
      if (state$1.dragTimeoutId) {
        window.clearTimeout(state$1.dragTimeoutId);
        state$1.dragTimeoutId = 0;
      }
      state$1.down = false;
      if (state$1.dragging) {
        state$1.dragging = false;
        transitions$1.onDragEnd({ event, state: state$1, setState: setState$1 });
        return;
      }
      if (event.button === buttons.left)
        transitions$1.onUp.left({ event, state: state$1, setState: setState$1 });
      if (event.button === buttons.right)
        transitions$1.onUp.right({ event, state: state$1, setState: setState$1 });
      if (state$1.singleClickTimeoutId) {
        window.clearTimeout(state$1.singleClickTimeoutId);
        state$1.singleClickTimeoutId = 0;
        if (event.button === buttons.left) {
          transitions$1.onClick.double.left({ event, state: state$1, setState: setState$1 });
        }
        if (event.button === buttons.right) {
          transitions$1.onClick.double.right({ event, state: state$1, setState: setState$1 });
        }
      } else {
        state$1.singleClickTimeoutId = window.setTimeout(() => {
          state$1.singleClickTimeoutId = 0;
          if (event.button === buttons.left) {
            transitions$1.onClick.single.left({ event, state: state$1, setState: setState$1 });
          }
          if (event.button === buttons.right) {
            transitions$1.onClick.single.right({ event, state: state$1, setState: setState$1 });
          }
        }, wait$1.doubleClick);
      }
    });

    element.addEventListener("wheel", (event) => {
      state$1.wheel = event.deltaY;
      if (state$1.wheelTimeoutId) return;
      window.setTimeout(() => {
        state$1.wheelTimeoutId = 0;
        transitions$1.onWheel({ event, state: state$1, setState: setState$1 });
      }, wait$1.wheel);
    });

    element.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  function withMouseState(cb = () => undefined) {
    return function (event) {
      cb({ event, state: state$1, setState: setState$1 });
    };
  }

  function setState$1(newState) {
    Object.assign(state$1, newState);
  }

  function setTransitions$1(newTransitions) {
    transitions$1 = deepMerge(transitions$1, newTransitions);
  }

  /**
   * TouchState keeps a general store on the state of touch events in order to make gesture calculations.
   * Shift any low-level touch API wrangling into here.  Communicate to the main application
   * via callbacks.
   */

  const state = {
    lastDistance: 0,
    lastTouchX: 0,
    lastTouchY: 0,
    movementX: 0,
    movementY: 0,
    ongoingTouches: [],
    pinchCenter: { clientX: 0, clientY: 0 },
    tapTimeoutId: 0,
  };
  const wait = { tap: 250, pinch: 100 };

  let transitions = {
    onStart: () => undefined,
    onMove: {
      single: () => undefined,
      double: () => undefined,
    },
    onEnd: () => undefined,
    onCancel: () => undefined,
    onTap: () => undefined,
    onSpread: () => undefined,
    onPinch: () => undefined,
  };

  var TouchState = { listenOn, setTransitions };

  function listenOn(element = window) {
    element.addEventListener("touchstart", (event) => {
      const touches = event.changedTouches;
      state.lastTouchX = event.changedTouches[0].pageX;
      state.lastTouchY = event.changedTouches[0].pageY;
      if (!state.ongoingTouches.length) {
        state.tapTimeoutId = window.setTimeout(() => {
          // tap timed out, "long press" detected
          state.tapTimeoutId = 0;
        }, wait.tap);
      }
      for (let i = 0, l = touches.length; i < l; i++) {
        state.ongoingTouches.push(copyTouch(touches[i]));
      }
      if (state.ongoingTouches.length == 2) {
        state.lastDistance = Math.sqrt(
          Math.pow(
            state.ongoingTouches[0].pageX - state.ongoingTouches[1].pageX,
            2
          ) +
            Math.pow(
              state.ongoingTouches[0].pageY - state.ongoingTouches[1].pageY,
              2
            )
        );
      }
      transitions.onStart({ event, state, setState });
    });

    element.addEventListener("touchcancel", (event) => {
      const touches = event.changedTouches;
      for (let i = 0; i < touches.length; ++i) {
        const idx = ongoingTouchIndexById(touches[i].identifier);
        state.ongoingTouches.splice(idx, 1);
      }
      transitions.onCancel({ event, state, setState });
    });

    element.addEventListener("touchend", (event) => {
      if (state.tapTimeoutId) {
        window.clearTimeout(state.tapTimeoutId);
        state.tapTimeoutId = 0;
        transitions.onTap({ event, state, setState });
      }
      const touches = event.changedTouches;
      for (let i = 0; i < touches.length; ++i) {
        const idx = ongoingTouchIndexById(touches[i].identifier);
        if (idx >= 0) state.ongoingTouches.splice(idx, 1);
      }
      transitions.onEnd({ event, state, setState });
    });
    element.addEventListener("touchmove", (event) => {
      state.movementX = event.changedTouches[0].pageX - state.lastTouchX;
      state.movementY = event.changedTouches[0].pageY - state.lastTouchY;
      if (state.ongoingTouches.length === 1) {
        transitions.onMove.single({ event, state, setState });
      } else if (state.ongoingTouches.length === 2) {
        const [a, b] = event.changedTouches;
        const distance = Math.sqrt(
          Math.pow(a.pageX - b.pageX, 2) + Math.pow(a.pageY - b.pageY, 2)
        );
        state.pinchCenter = {
          clientX: (a.clientX + b.clientX) / 2,
          clientY: (a.clientY + b.clientY) / 2,
        };
        transitions.onMove.double({ event, state, setState });
        if (distance > state.lastDistance) {
          transitions.onSpread({ event, state, setState });
        }
        if (distance < state.lastDistance) {
          transitions.onPinch({ event, state, setState });
        }
        state.lastDistance = distance;
      }
      state.lastTouchX = event.changedTouches[0].pageX;
      state.lastTouchY = event.changedTouches[0].pageY;
    });
  }

  function copyTouch(touch) {
    return {
      identifier: touch.identifier,
      pageX: touch.pageX,
      pageY: touch.pageY,
    };
  }

  function ongoingTouchIndexById(id) {
    return state.ongoingTouches.findIndex(({ identifier }) => identifier === id);
  }

  /**
   * Callback for external code to modify these private variables.
   */
  function setState(newState) {
    Object.assign(state, newState);
  }

  function setTransitions(newTransitions) {
    transitions = deepMerge(transitions, newTransitions);
  }

  let zoomCallback = () => undefined;

  var Zoom = {
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

  class Patchbay {
    /**
     * @param {HTMLElement} parent - <svg>
     */
    constructor({
      data = [],
      groups = [],
      name = "",
      patches = [],
      parent = document.body,
    } = {}) {
      this.readOnly = true; // TODO make this configurable
      this.loadingAnimationSpeed = 3; // TODO make this configurable
      this.data = data; // object of patchbay data
      this.edited = false;
      this.groups = groups; // metadata: groups of patch groups
      this.hasPatchedBefore = false;
      this.isPatchDrag = false; // currently dragging a patch cable around
      this.isPressed = false; // non-interactive part has mouse down, for panning
      this.name = name;
      this.overviewScale = 20;
      this.overviewTarget;
      this.parent = parent;
      this.patchDragIndex; // which cable is currently being dragged
      this.patchList = []; // PatchCable[]
      this.patches = patches; //! currently disabled
      this.patchingFlag = false; // true indicates patch is in unfinished state
      this.showingTip = false;

      this.create();
    }

    create() {
      this.clear();
      this.container = SVG.createElement("svg", { id: "patchbay" });
      this.overview = SVG.createElement("svg", { id: "overview" });
      this.parent.appendChild(this.container);
      this.parent.appendChild(this.overview);
      this.addControls();
      this.draw();
      this.addListeners();
      this.textTags = this.container.querySelectorAll("text");
      Zoom.setOnZoom((view) => this.overviewTarget.position(view));
    }

    clear() {
      HTML.remove("#controls");
      HTML.remove("#patchbay");
      HTML.remove("#overview");
    }

    addControls() {
      const movements = {
        U: { movementX: 0, movementY: "20%" },
        D: { movementX: 0, movementY: "-20%" },
        L: { movementX: "20%", movementY: 0 },
        R: { movementX: "-20%", movementY: 0 },
      };
      this.controls = HTML.createElement("div", {
        id: "controls",
        children: [
          HTML.createElement("div", {
            id: "panner",
            children: ["U", "LR", "D"].map((dir) =>
              HTML.createElement("div", {
                children: dir.split("").map((dir) =>
                  HTML.createElement("button", {
                    onClick: () => Zoom.pan(this.container, movements[dir]),
                    class: "panner",
                    child: SVG.createElement("svg", {
                      class: "panAndZoom",
                      child: SVG.createPanArrow(dir),
                    }),
                  })
                ),
              })
            ),
          }),
          ...["In", "Out"].map((dir) =>
            HTML.createElement("div", {
              child: HTML.createElement("button", {
                class: "panAndZoom",
                textContent: dir === "In" ? "+" : "-",
                onClick:
                  dir === "In"
                    ? () => Zoom.into(this.container)
                    : () => Zoom.out(this.container),
              }),
            })
          ),
        ],
      });
      document.body.appendChild(this.controls);
      if (this.edited) {
        const save = HTML.createElement("button", {
          class: "save",
          textContent: "Save changes",
          onClick: () => {
            save.remove();
            this.edited = false;
          },
        });
        this.parent.appendChild(save);
      }
    }

    addListeners() {
      Mouse.listenOn(this.container);
      Mouse.setTransitions({
        onClick: {
          single: {
            left: ({ event }) => {
              event.preventDefault();
              if (["circle", "path"].includes(event.target.tagName)) {
                this.patch(event.target);
              }
            },
            right: ({ event }) => {
              if (
                event.target.classList.contains("patchGroup") ||
                event.target.classList.contains("blank")
              ) {
                return this.editMenu(event);
              }
              if (event.target === this.container) this.editMenu(event, true);
            },
          },
          double: {
            left: ({ event }) => {
              event.preventDefault();
              Zoom.into(this.container, event);
            },
            right: ({ event }) => Zoom.out(this.container, event),
          },
        },
        onDown: {
          left: ({ event }) => this.mouseOrTouchDown(event),
        },
        onDrag: ({ event, setState }) => {
          setState({ dragging: true });
          if (this.isPatchDrag) {
            event.preventDefault(); // unsure what reason is for this call
            const patch = this.patchList[this.patchDragIndex];
            patch.move(event);
          } else if (this.isPressed) {
            this.container.style.cursor = "move";
            Zoom.pan(this.container, event);
          }
        },
        onDragEnd: () => {
          if (this.isPatchDrag) {
            this.isPatchDrag = false;
          }
          this.container.style.cursor = "default";
        },
        onUp: {
          left: ({ event }) => {
            this.isPressed = false;
            if (
              event.target.classList.contains("patchGroup") &&
              !this.showingTip
            ) {
              this.showTip(event);
            }
          },
        },
        onWheel: ({ event, state }) => {
          if (state.wheel > 0) Zoom.out(this.container, event);
          else if (state.wheel < 0) Zoom.into(this.container, event);
        },
      });
      TouchState.listenOn(this.container);
      TouchState.setTransitions({
        onStart: ({ event }) => {
          this.mouseOrTouchDown(event);
        },
        onEnd: () => {
          this.isPatchDrag = false;
          this.isPressed = false;
        },
        onCancel: () => {
          this.isPatchDrag = false;
        },
        onMove: {
          single: ({ state }) => {
            if (this.isPatchDrag) {
              this.patchList[this.patchDragIndex].move(state);
            } else {
              Zoom.pan(this.container, state);
            }
          },
        },
        onSpread: ({ state }) => {
          Zoom.into(this.container, state.pinchCenter, 1.1);
        },
        onPinch: ({ state }) => {
          Zoom.out(this.container, state.pinchCenter, 1.1);
        },
        onTap: ({ event, state }) => {
          event.preventDefault();
          if (["circle", "path"].includes(event.target.tagName)) {
            this.patch(event.target);
          }
          if (event.target.classList.contains("patchGroup") && !this.showingTip) {
            Object.assign(event, {
              clientX: state.lastTouchX,
              clientY: state.lastTouchY,
            });
            this.showTip(event);
          }
        },
      });
      // MOUSE ENTERS WINDOW W/O BUTTON PRESSED
      document.body.addEventListener("mouseenter", (e) => {
        if (e.buttons === 0) {
          if (this.isPatchDrag) {
            this.isPatchDrag = false;
          }
          if (this.isPressed) {
            this.container.style.cursor = "default";
            this.isPressed = false;
          }
        }
      });
      // overview clicks
      this.overview.addEventListener("click", ({ clientX, clientY }) => {
        const { left, top } = this.overview.getBoundingClientRect();
        Zoom.panTo(this.container, {
          x: (clientX - left) * this.overviewScale,
          y: (clientY - top) * this.overviewScale,
        });
      });
    }

    mouseOrTouchDown(event) {
      event.preventDefault(); // to avoid highlighting text
      if (event.target.tagName === "path") {
        this.isPatchDrag = true;
        this.patchDragIndex = this.patchList.findIndex(
          ({ path }) => path === event.target
        );
        return;
      }
      this.isPressed = true;
    }

    /**
     * @method draw paints the patchbay as described in the data
     */
    draw() {
      let y = 0,
        h = this.data.length,
        w = 0;
      this.data.forEach((row) => {
        let x = 0;
        row.forEach((group) => {
          const { element, width } = new PatchGroup({
            x,
            y,
            ...group,
          }).createElement();
          x += width;
          this.container.appendChild(element);
          const gCopy = element.cloneNode(true);
          // remove ID attributes to avoid ID queries grabbing wrong element
          Array.from(gCopy.childNodes).forEach((child) =>
            child.removeAttribute("id")
          );
          this.overview.appendChild(gCopy);
        });
        x > w && (w = x); // record maximum row length as w
        y += PatchGroup.rowHeight; // set y to the next row
      });
      Zoom.setViewBox(this.container, {
        x: 0,
        y: 0,
        width: w,
        height: y,
      });
      this.drawOverview({ h, w, y });
    }

    drawOverview({ h, w, y }) {
      this.overviewTarget = SVG.createElement("rect", {
        x: 0,
        y: 0,
        width: window.innerWidth,
        height: window.innerHeight,
        fill: "none",
        stroke: "red",
        "stroke-width": "50",
      });
      this.overviewTarget.position = function (dimensions) {
        for (const key in dimensions) this.setAttribute(key, dimensions[key]);
      };
      this.overview.appendChild(this.overviewTarget);
      this.overview.setAttribute(
        "height",
        (PatchGroup.rowHeight * h) / this.overviewScale + "px"
      );
      this.overview.setAttribute("width", w / this.overviewScale + "px");
      this.overview.setAttribute("viewBox", "0 0 " + w + " " + y);
    }

    editMenu(e, blank) {
      if (this.readOnly) {
        return;
      }
      const [row, group] = blank
        ? [0, 0]
        : e.target.getAttribute("id").split(",");
      const { editForm } = new PatchGroup(
        blank ? {} : this.data[row - 1][group - 1]
      ).createEditForm();
      const editDiv = HTML.modal({
        child: editForm,
        okText: "Set",
        onOk: () => {
          const editedGroup = PatchGroup.readEditForm(editForm);
          this.edited = true;
          this.update(row, group, editedGroup);
          this.create();
        },
      });
      this.parent.appendChild(editDiv);
      HTML.setTopAndLeftToClick(editDiv, e);
    }

    waitForNewPatchbay() {
      HTML.empty(this.container);
      Zoom.setViewBox(this.container, {
        x: 0,
        y: 0,
        width: window.innerWidth,
        height: window.innerHeight,
      });
      let increasing = true;
      const red = { value: 0, max: 255, min: 0 };
      const radius = {
        value: window.innerWidth / 4,
        max: window.innerWidth / 3,
        min: window.innerWidth / 4,
        linearMap({ value, max, min }) {
          this.value = this.min + (value * (this.max - this.min)) / (max - min);
        },
      };
      const bigPatch = SVG.createElement("circle", {
        cx: window.innerWidth / 2,
        cy: window.innerHeight / 2,
        r: radius.value,
        fill: `rgb(${red.value},0,0)`,
        id: "bigPatch",
      });
      this.container.appendChild(bigPatch);
      function animateBigPatch() {
        if (!document.getElementById("bigPatch")) return;
        if (increasing && red.value >= red.max) increasing = false;
        else if (!increasing && red.value <= red.min) increasing = true;
        red.value += increasing
          ? this.loadingAnimationSpeed
          : -this.loadingAnimationSpeed;
        radius.linearMap(red);
        bigPatch.setAttribute("fill", `rgb(${red.value},0,0`);
        bigPatch.setAttribute("r", radius.value);
        window.requestAnimationFrame(animateBigPatch);
      }
      window.requestAnimationFrame(animateBigPatch);
    }

    update(row, group, editedGroup) {
      if (row - 1 === editedGroup.row && group - 1 === editedGroup.group) {
        // same position
        this.data[row - 1][group - 1] = editedGroup;
        return;
      }
      // newly created patch groups will call this function with row = 0
      if (row > 0) {
        // remove old entry
        this.data[row - 1].splice(group - 1, 1);
        // adjust groups
        this.data[row - 1].forEach((data, index) => (data.group = index + 1));
      }
      // insert
      if (editedGroup.row - 1 < this.data.length) {
        if (editedGroup.group < this.data[editedGroup.row - 1].length) {
          this.data[editedGroup.row - 1].splice(
            editedGroup.group - 1,
            0,
            editedGroup
          );
          // adjust groups
          this.data[editedGroup.row - 1].forEach(
            (data, index) => (data.group = index + 1)
          );
        } else {
          const filler = Array.from({
            length: Number(editedGroup.group) - 1,
          }).map((_, i) => blank(i));
          this.data.push([...filler, editedGroup]);
        }
      } else {
        Array.from({
          length: Number(editedGroup.row) - 1 - this.data.length,
        })
          .map((_, i) => [blank(i)])
          .forEach((row) => this.data.push(row));
        const filler = Array.from({
          length: Number(editedGroup.group) - 1,
        }).map((_, i) => blank(i));
        this.data.push([...filler, editedGroup]);
      }
      function blank(i) {
        return {
          name: "",
          description: "",
          row: editedGroup.row,
          group: i + 1,
          span: 1,
          enumeration: [],
          normals: "",
          tags: [],
          color: "white",
        };
      }
    }

    patchTip(elem, colorOpt) {
      return document.body.appendChild(
        HTML.modal({
          onClose: () => {
            this.hasPatchedBefore = true;
            this.patch(elem, colorOpt);
          },
          closeText: "Ok",
          child: HTML.createElement("p", {
            textContent:
              "Click the circles (patch points) to draw a patch cable.  Click on a finished patch to remove it.",
          }),
          blocking: true,
        })
      );
    }

    /**
     * @method patch Handles dblclick events on the <circle> elements
     * @param {svg <circle> element} circle - the circle to patch or clear
     */
    patch(elem, colorOpt = "red") {
      if (!this.hasPatchedBefore) {
        return this.patchTip(elem, colorOpt);
      }
      if (elem.getAttribute("patched") == "false") {
        if (!this.patchingFlag) {
          const color = colorOpt;
          const p = new PatchCable(this.container, color);
          p.drawPatch(elem, "start");
          this.patchingFlag = true;
          this.patchList.push(p);
        } else {
          // currently patching
          this.patchList[this.patchList.length - 1].drawPatch(elem, "end");
          this.patchingFlag = false;
        }
        return;
      }
      const index = this.patchList.findIndex(
        (patch) => patch.start == elem || patch.stop == elem || patch.path == elem
      );
      if (index > -1) {
        this.patchingFlag = false;
        this.patchList[index].clearPatch();
        this.patchList.splice(index, 1);
      }
    }

    showTip(event) {
      this.showingTip = true;
      const tipBox = HTML.tipBox({
        children: [
          HTML.createElement("h3", {
            textContent: event.target.previousSibling.textContent,
          }),
          document.createTextNode(
            event.target.getAttribute("desc") || "No description available"
          ),
        ],
        useMousePosition: event,
      });
      const cleanup = () => {
        tipBox.remove();
        // delay prevents immediately showing another tip box
        window.setTimeout(() => (this.showingTip = false), 25);
        Array.from(event.target.parentNode.querySelectorAll(".normals")).forEach(
          (el) => HTML.setInvisible(el)
        );
        event.target.classList.remove("patchGroupHighlight");
      };
      document.body.appendChild(tipBox);
      if (event.type === "mouseup")
        event.target.addEventListener("mouseleave", cleanup, {
          once: true,
        });
      if (event.type === "touchend")
        window.addEventListener("touchstart", cleanup, {
          once: true,
        });
      Array.from(event.target.parentNode.querySelectorAll(".normals")).forEach(
        (el) => HTML.setVisible(el)
      );
    }
  }

  return Patchbay;

}());
