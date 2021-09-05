import deepMerge from "./deepMerge";

const buttons = { left: 0, right: 2 };
const wait = { doubleClick: 300, drag: 40, wheel: 125 };
const state = {
  down: false,
  dragTimeoutId: 0,
  dragging: false,
  singleClickTimeoutId: 0,
  wheel: 0,
  wheelTimeoutId: 0,
};

let transitions = {
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

export default {
  listenOn,
  setTransitions,
  withMouseState,
};

function listenOn(element = window) {
  element.addEventListener("mousemove", (event) => {
    if (state.down) transitions.onDrag({ event, state, setState });
    else transitions.onMove({ event, state, setState });
  });

  element.addEventListener("mousedown", (event) => {
    state.dragTimeoutId = window.setTimeout(() => {
      state.dragTimeoutId = 0;
      state.down = true;
    }, wait.drag);
    if (event.button === buttons.left)
      transitions.onDown.left({ event, state, setState });
    if (event.button === buttons.right)
      transitions.onDown.right({ event, state, setState });
  });

  // re-creates logic to detect "click" and "double click" events
  element.addEventListener("mouseup", (event) => {
    if (state.dragTimeoutId) {
      window.clearTimeout(state.dragTimeoutId);
      state.dragTimeoutId = 0;
    }
    state.down = false;
    if (state.dragging) {
      state.dragging = false;
      transitions.onDragEnd({ event, state, setState });
      return;
    }
    if (event.button === buttons.left)
      transitions.onUp.left({ event, state, setState });
    if (event.button === buttons.right)
      transitions.onUp.right({ event, state, setState });
    if (state.singleClickTimeoutId) {
      window.clearTimeout(state.singleClickTimeoutId);
      state.singleClickTimeoutId = 0;
      if (event.button === buttons.left) {
        transitions.onClick.double.left({ event, state, setState });
      }
      if (event.button === buttons.right) {
        transitions.onClick.double.right({ event, state, setState });
      }
    } else {
      state.singleClickTimeoutId = window.setTimeout(() => {
        state.singleClickTimeoutId = 0;
        if (event.button === buttons.left) {
          transitions.onClick.single.left({ event, state, setState });
        }
        if (event.button === buttons.right) {
          transitions.onClick.single.right({ event, state, setState });
        }
      }, wait.doubleClick);
    }
  });

  element.addEventListener("wheel", (event) => {
    state.wheel = event.deltaY;
    if (state.wheelTimeoutId) return;
    window.setTimeout(() => {
      state.wheelTimeoutId = 0;
      transitions.onWheel({ event, state, setState });
    }, wait.wheel);
  });

  element.addEventListener("contextmenu", (e) => e.preventDefault());
}

function withMouseState(cb = () => undefined) {
  return function (event) {
    cb({ event, state, setState });
  };
}

function setState(newState) {
  Object.assign(state, newState);
}

function setTransitions(newTransitions) {
  transitions = deepMerge(transitions, newTransitions);
}
