// On-screen Game Boy Pocket controls.
//
// Touch and mouse presses are turned into real keyboard events, so the game
// reads them exactly like a physical keyboard. multi-key-handler watches those
// same events (physical or on-screen) and lights up the matching buttons.

export const KEYS = {
  up: { code: "ArrowUp", key: "ArrowUp", keyCode: 38 },
  down: { code: "ArrowDown", key: "ArrowDown", keyCode: 40 },
  left: { code: "ArrowLeft", key: "ArrowLeft", keyCode: 37 },
  right: { code: "ArrowRight", key: "ArrowRight", keyCode: 39 },
  a: { code: "KeyX", key: "x", keyCode: 88 },
  b: { code: "KeyZ", key: "z", keyCode: 90 },
  start: { code: "Enter", key: "Enter", keyCode: 13 },
  select: { code: "Space", key: " ", keyCode: 32 },
};

const DIRECTIONS = ["up", "down", "left", "right"];
const DEAD_ZONE = 0.3;
const POINTER_END = ["pointerup", "pointercancel", "lostpointercapture"];

// Presses and releases buttons by dispatching keyboard events on `target`.
export function createKeys(target = window) {
  const held = new Set();

  function send(type, button) {
    const { code, key, keyCode } = KEYS[button];
    target.dispatchEvent(
      new KeyboardEvent(type, { code, key, keyCode, which: keyCode, bubbles: true, cancelable: true }),
    );
  }

  return {
    press(button) {
      if (held.has(button)) return;
      held.add(button);
      send("keydown", button);
    },
    release(button) {
      if (!held.delete(button)) return;
      send("keyup", button);
    },
    // Sent unconditionally so physical keys stuck down by a focus change are cleared too.
    releaseAll() {
      held.clear();
      for (const button of Object.keys(KEYS)) send("keyup", button);
    },
  };
}

export function bindButton(element, keys) {
  const button = element.dataset.button;

  element.addEventListener("pointerdown", e => {
    e.preventDefault();
    element.setPointerCapture(e.pointerId);
    keys.press(button);
  });
  for (const type of POINTER_END) element.addEventListener(type, () => keys.release(button));
}

// One finger steers the whole pad: its position decides which directions are held, so it can slide to a diagonal.
export function bindDpad(element, keys) {
  let pointerId = null;

  function steer(e) {
    const box = element.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * 2 - 1;
    const y = ((e.clientY - box.top) / box.height) * 2 - 1;
    const want = {
      up: y < -DEAD_ZONE,
      down: y > DEAD_ZONE,
      left: x < -DEAD_ZONE,
      right: x > DEAD_ZONE,
    };
    for (const direction of DIRECTIONS) {
      if (want[direction]) keys.press(direction);
      else keys.release(direction);
    }
  }

  function stop(e) {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    for (const direction of DIRECTIONS) keys.release(direction);
  }

  element.addEventListener("pointerdown", e => {
    if (pointerId !== null) return;
    e.preventDefault();
    pointerId = e.pointerId;
    element.setPointerCapture(pointerId);
    steer(e);
  });
  element.addEventListener("pointermove", e => {
    if (e.pointerId === pointerId) steer(e);
  });
  for (const type of POINTER_END) element.addEventListener(type, stop);
}

// Returns a function that lights every [data-lit] element whose key is down in the handler's state object.
export function createLights(root = document) {
  const lights = new Map();
  for (const element of root.querySelectorAll("[data-lit]")) {
    const name = element.dataset.lit;
    lights.set(name, [...(lights.get(name) ?? []), element]);
  }

  return states => {
    const on = {
      up: states.up,
      down: states.down,
      left: states.left,
      right: states.right,
      a: states.x,
      b: states.z,
      start: states["\r"],
      select: states[" "] || states["\x10"] || states["\b"],
    };
    for (const [name, elements] of lights) {
      for (const element of elements) element.classList.toggle("is-lit", Boolean(on[name]));
    }
  };
}

// Keeps touches from selecting text, dragging images, opening menus or pinch-zooming.
export function blockGestures(doc = document) {
  for (const type of ["contextmenu", "selectstart", "dragstart", "gesturestart"]) {
    doc.addEventListener(type, e => e.preventDefault());
  }
}

// Orientation lock only works for installed or fullscreen apps; elsewhere the CSS prompts for portrait instead.
export function lockPortrait(win = window) {
  win.screen.orientation?.lock?.("portrait").catch(() => {});
}

// A phone held in landscape freezes the game (the page shows a rotate prompt in its place).
export function watchOrientation(win, doc, keys) {
  const landscape = win.matchMedia("(orientation: landscape) and (pointer: coarse) and (max-height: 600px)");

  function suspend() {
    doc.documentElement.toggleAttribute("data-suspended", landscape.matches);
    if (landscape.matches) keys.releaseAll();
  }

  landscape.addEventListener("change", suspend);
  suspend();
}

export async function initHandheld(doc = document, win = window) {
  const keys = createKeys(win);

  doc.querySelectorAll("[data-button]").forEach(element => bindButton(element, keys));
  doc.querySelectorAll("[data-dpad]").forEach(element => bindDpad(element, keys));
  win.addEventListener("blur", keys.releaseAll);
  blockGestures(doc);
  lockPortrait(win);
  watchOrientation(win, doc, keys);

  // Button lighting is optional: the game still plays if the package can't be loaded.
  try {
    const { MultiKeyHandler } = await import("multi-key-handler");
    // Shift and Backspace are the game's alternate Select keys.
    new MultiKeyHandler(createLights(doc), { keys: "xz\r \x10\b", arrows: true });
  } catch (error) {
    console.warn("multi-key-handler unavailable; buttons won't light up.", error);
  }
}
