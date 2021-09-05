import SVG from "./SVG";
import PatchCable from "./PatchCable";
import HTML from "./HTML";
import PatchGroup from "./PatchGroup";
import Mouse from "./Mouse";
import TouchState from "./TouchState";
import Zoom from "./Zoom";

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

export default Patchbay;
