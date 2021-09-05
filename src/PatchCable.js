import SVG from "./SVG";

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

export default PatchCable;
