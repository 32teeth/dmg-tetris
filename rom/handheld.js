// On-screen Game Boy Pocket controls.
//
// Touch and mouse presses are turned into real keyboard events, so the game
// reads them exactly like a physical keyboard. multi-key-handler watches those
// same events (physical or on-screen) and lights up the matching buttons.

const KEYS = {
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

const held = new Set();

function send(type, button) {
  const { code, key, keyCode } = KEYS[button];
  dispatchEvent(
    new KeyboardEvent(type, {
      code,
      key,
      keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true,
    }),
  );
}

function press(button) {
  if (held.has(button)) return;
  held.add(button);
  send("keydown", button);
}

function release(button) {
  if (!held.delete(button)) return;
  send("keyup", button);
}

function releaseAll() {
  held.clear();
  // Sent unconditionally so physical keys stuck down by a focus change are cleared too.
  for (const button of Object.keys(KEYS)) send("keyup", button);
}

function bindButton(element) {
  const button = element.dataset.button;

  element.addEventListener("pointerdown", e => {
    e.preventDefault();
    element.setPointerCapture(e.pointerId);
    press(button);
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    element.addEventListener(type, () => release(button));
  }
}

function bindDpad(element) {
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
      if (want[direction]) press(direction);
      else release(direction);
    }
  }

  function stop(e) {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    for (const direction of DIRECTIONS) release(direction);
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
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
    element.addEventListener(type, stop);
  }
}

document.querySelectorAll("[data-button]").forEach(bindButton);
document.querySelectorAll("[data-dpad]").forEach(bindDpad);
addEventListener("blur", releaseAll);
document.addEventListener("contextmenu", e => e.preventDefault());

// Button lighting. The game still plays if the package can't be loaded.
const lights = new Map();
for (const element of document.querySelectorAll("[data-lit]")) {
  const name = element.dataset.lit;
  lights.set(name, [...(lights.get(name) ?? []), element]);
}

function light(states) {
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
}

try {
  const { MultiKeyHandler } = await import("multi-key-handler");
  // Shift and Backspace are the game's alternate Select keys.
  new MultiKeyHandler(light, { keys: "xz\r \x10\b", arrows: true });
} catch (error) {
  console.warn("multi-key-handler unavailable; buttons won't light up.", error);
}
