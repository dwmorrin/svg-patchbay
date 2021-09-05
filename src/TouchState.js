/**
 * TouchState keeps a general store on the state of touch events in order to make gesture calculations.
 * Shift any low-level touch API wrangling into here.  Communicate to the main application
 * via callbacks.
 */

import deepMerge from "./deepMerge";

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

export default { listenOn, setTransitions };

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
