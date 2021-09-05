import HTML from "./HTML";
import SVG from "./SVG";

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

export default PatchGroup;
