import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { KEYMAP } from "../rom/tetris.js";
import {
  KEYS,
  bindButton,
  bindDpad,
  blockGestures,
  createKeys,
  createLights,
  initHandheld,
  lockPortrait,
  watchOrientation,
} from "../rom/handheld.js";

const events = [];
const record = e => events.push(`${e.type === "keydown" ? "down" : "up"}:${e.code}`);

beforeEach(() => {
  events.length = 0;
  window.addEventListener("keydown", record);
  window.addEventListener("keyup", record);
  Element.prototype.setPointerCapture = vi.fn();
});

afterEach(() => {
  window.removeEventListener("keydown", record);
  window.removeEventListener("keyup", record);
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("data-suspended");
  vi.restoreAllMocks();
});

// jsdom has no PointerEvent, and the code only needs these fields.
const pointer = (type, { pointerId = 1, ...init } = {}) => {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...init });
  event.pointerId = pointerId;
  return event;
};

describe("KEYS", () => {
  it("sends the key each button is mapped to in the game", () => {
    for (const [button, { code }] of Object.entries(KEYS)) {
      expect(KEYMAP[code]).toBe(button);
    }
  });

  it("covers the eight Game Boy buttons", () => {
    expect(Object.keys(KEYS).sort()).toEqual(["a", "b", "down", "left", "right", "select", "start", "up"]);
  });
});

describe("createKeys", () => {
  it("presses and releases as real keyboard events, with legacy key codes", () => {
    const seen = [];
    window.addEventListener("keydown", e => seen.push(e), { once: true });
    const keys = createKeys();

    keys.press("a");
    keys.release("a");

    expect(events).toEqual(["down:KeyX", "up:KeyX"]);
    expect(seen[0]).toMatchObject({ code: "KeyX", key: "x", keyCode: 88, bubbles: true, cancelable: true });
  });

  it("sends each press only once until released", () => {
    const keys = createKeys();
    keys.press("start");
    keys.press("start");
    keys.release("start");
    keys.release("start");
    expect(events).toEqual(["down:Enter", "up:Enter"]);
  });

  it("releases every button on demand, even ones it did not press", () => {
    const keys = createKeys();
    keys.press("left");
    events.length = 0;
    keys.releaseAll();
    expect(events).toHaveLength(8);
    expect(new Set(events.map(e => e.split(":")[1]))).toEqual(new Set(Object.values(KEYS).map(k => k.code)));

    events.length = 0;
    keys.press("left");
    expect(events).toEqual(["down:ArrowLeft"]);
  });

  it("can target another element", () => {
    const target = document.createElement("div");
    const heard = vi.fn();
    target.addEventListener("keydown", heard);
    createKeys(target).press("up");
    expect(heard).toHaveBeenCalledOnce();
    expect(events).toEqual([]);
  });
});

describe("bindButton", () => {
  const setup = button => {
    const element = document.createElement("button");
    element.dataset.button = button;
    document.body.append(element);
    bindButton(element, createKeys());
    return element;
  };

  it("holds the key while the pointer is down", () => {
    const element = setup("b");
    const down = pointer("pointerdown");
    element.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    expect(element.setPointerCapture).toHaveBeenCalledWith(1);
    expect(events).toEqual(["down:KeyZ"]);

    element.dispatchEvent(pointer("pointerup"));
    expect(events).toEqual(["down:KeyZ", "up:KeyZ"]);
  });

  it.each(["pointercancel", "lostpointercapture"])("lets go on %s", type => {
    const element = setup("select");
    element.dispatchEvent(pointer("pointerdown"));
    element.dispatchEvent(pointer(type));
    expect(events).toEqual(["down:Space", "up:Space"]);
  });
});

describe("bindDpad", () => {
  const SIZE = 150;
  const setup = () => {
    const element = document.createElement("div");
    element.getBoundingClientRect = () => ({ left: 100, top: 200, width: SIZE, height: SIZE });
    document.body.append(element);
    bindDpad(element, createKeys());
    return element;
  };
  // Positions are fractions across the pad, 0 = left/top edge, 1 = right/bottom edge.
  const at = (type, fx, fy, init = {}) => pointer(type, { clientX: 100 + fx * SIZE, clientY: 200 + fy * SIZE, ...init });

  it.each([
    [0.1, 0.5, "ArrowLeft"],
    [0.9, 0.5, "ArrowRight"],
    [0.5, 0.1, "ArrowUp"],
    [0.5, 0.9, "ArrowDown"],
  ])("presses the direction under the finger (%s, %s)", (fx, fy, code) => {
    const element = setup();
    const down = at("pointerdown", fx, fy);
    element.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    expect(events).toEqual([`down:${code}`]);
    element.dispatchEvent(at("pointerup", fx, fy));
    expect(events).toEqual([`down:${code}`, `up:${code}`]);
  });

  it("presses nothing in the dead zone at the centre", () => {
    const element = setup();
    element.dispatchEvent(at("pointerdown", 0.5, 0.5));
    expect(events).toEqual([]);
  });

  it("holds two directions for a diagonal and follows the finger as it slides", () => {
    const element = setup();
    element.dispatchEvent(at("pointerdown", 0.1, 0.9));
    expect(new Set(events)).toEqual(new Set(["down:ArrowDown", "down:ArrowLeft"]));

    events.length = 0;
    element.dispatchEvent(at("pointermove", 0.9, 0.9));
    expect(new Set(events)).toEqual(new Set(["up:ArrowLeft", "down:ArrowRight"]));

    events.length = 0;
    element.dispatchEvent(at("pointerup", 0.9, 0.9));
    expect(new Set(events)).toEqual(new Set(["up:ArrowDown", "up:ArrowRight"]));
  });

  it("follows a single finger and ignores a second one", () => {
    const element = setup();
    element.dispatchEvent(at("pointerdown", 0.1, 0.5, { pointerId: 1 }));
    events.length = 0;

    element.dispatchEvent(at("pointerdown", 0.9, 0.5, { pointerId: 2 }));
    element.dispatchEvent(at("pointermove", 0.5, 0.1, { pointerId: 2 }));
    element.dispatchEvent(at("pointerup", 0.5, 0.1, { pointerId: 2 }));
    expect(events).toEqual([]);

    element.dispatchEvent(at("pointerup", 0.1, 0.5, { pointerId: 1 }));
    expect(events).toEqual(["up:ArrowLeft"]);
  });

  it("can be used again after the finger lifts", () => {
    const element = setup();
    element.dispatchEvent(at("pointerdown", 0.1, 0.5));
    element.dispatchEvent(at("pointercancel", 0.1, 0.5));
    events.length = 0;
    element.dispatchEvent(at("pointerdown", 0.5, 0.9, { pointerId: 7 }));
    expect(events).toEqual(["down:ArrowDown"]);
  });

  it("ignores movement when no finger is down", () => {
    const element = setup();
    element.dispatchEvent(at("pointermove", 0.1, 0.5));
    expect(events).toEqual([]);
  });
});

describe("createLights", () => {
  const build = names => {
    document.body.innerHTML = names.map(n => `<i data-lit="${n}"></i>`).join("");
    return createLights(document);
  };
  const lit = name => document.querySelector(`[data-lit="${name}"]`).classList.contains("is-lit");

  it("lights the buttons whose keys are down", () => {
    const light = build(["a", "b", "start", "select", "up", "down", "left", "right"]);
    light({ x: true, z: false, "\r": true, up: true, left: false });
    expect(["a", "b", "start", "select", "up", "down", "left", "right"].map(lit)).toEqual([
      true, false, true, false, true, false, false, false,
    ]);

    light({ x: false, "\r": false, up: false });
    expect(document.querySelectorAll(".is-lit")).toHaveLength(0);
  });

  it.each([" ", "\x10", "\b"])("lights Select for key %j", key => {
    const light = build(["select"]);
    light({ [key]: true });
    expect(lit("select")).toBe(true);
  });

  it("lights every element that shares a name", () => {
    document.body.innerHTML = '<i data-lit="a"></i><b data-lit="a"></b>';
    createLights(document)({ x: true });
    expect(document.querySelectorAll(".is-lit")).toHaveLength(2);
  });
});

describe("blockGestures", () => {
  it.each(["contextmenu", "selectstart", "dragstart", "gesturestart"])("cancels %s", type => {
    blockGestures(document);
    const event = new Event(type, { bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});

describe("lockPortrait", () => {
  it("asks the browser to lock the orientation", () => {
    const lock = vi.fn().mockResolvedValue();
    lockPortrait({ screen: { orientation: { lock } } });
    expect(lock).toHaveBeenCalledWith("portrait");
  });

  it("shrugs off browsers that refuse or cannot lock", async () => {
    const lock = vi.fn().mockRejectedValue(new Error("not fullscreen"));
    expect(() => lockPortrait({ screen: { orientation: { lock } } })).not.toThrow();
    await Promise.resolve();
    expect(() => lockPortrait({ screen: {} })).not.toThrow();
    expect(() => lockPortrait({ screen: { orientation: {} } })).not.toThrow();
  });
});

describe("watchOrientation", () => {
  const media = matches => {
    const query = { matches, listener: null, addEventListener: (_, fn) => (query.listener = fn) };
    return query;
  };

  it("suspends the game and releases the buttons while a phone is in landscape", () => {
    const query = media(true);
    const keys = { releaseAll: vi.fn() };
    watchOrientation({ matchMedia: () => query }, document, keys);
    expect(document.documentElement.hasAttribute("data-suspended")).toBe(true);
    expect(keys.releaseAll).toHaveBeenCalled();
  });

  it("leaves the game running in portrait and reacts when the device turns", () => {
    const query = media(false);
    const keys = { releaseAll: vi.fn() };
    watchOrientation({ matchMedia: () => query }, document, keys);
    expect(document.documentElement.hasAttribute("data-suspended")).toBe(false);
    expect(keys.releaseAll).not.toHaveBeenCalled();

    query.matches = true;
    query.listener();
    expect(document.documentElement.hasAttribute("data-suspended")).toBe(true);
    expect(keys.releaseAll).toHaveBeenCalledOnce();

    query.matches = false;
    query.listener();
    expect(document.documentElement.hasAttribute("data-suspended")).toBe(false);
  });
});

describe("initHandheld", () => {
  const layout = `
    <div data-dpad>
      <svg>
        <polygon data-lit="up"></polygon><polygon data-lit="down"></polygon>
        <polygon data-lit="left"></polygon><polygon data-lit="right"></polygon>
      </svg>
    </div>
    <button data-button="b" data-lit="b"></button>
    <button data-button="a" data-lit="a"></button>
    <button data-button="select" data-lit="select"></button>
    <button data-button="start" data-lit="start"></button>`;
  const lit = name => document.querySelector(`[data-lit="${name}"]`).classList.contains("is-lit");
  const press = (type, keyCode, code) =>
    window.dispatchEvent(new KeyboardEvent(type, { code, keyCode, bubbles: true, cancelable: true }));

  beforeEach(() => {
    document.body.innerHTML = layout;
    window.matchMedia = vi.fn(() => ({ matches: false, addEventListener: vi.fn() }));
  });

  it("lights buttons for physical key presses, via multi-key-handler", async () => {
    await initHandheld();

    press("keydown", 88, "KeyX");
    press("keydown", 37, "ArrowLeft");
    expect(lit("a")).toBe(true);
    expect(lit("left")).toBe(true);
    expect(lit("b")).toBe(false);

    press("keyup", 88, "KeyX");
    expect(lit("a")).toBe(false);
    expect(lit("left")).toBe(true);
  });

  it("lights Select for Space, Shift and Backspace", async () => {
    await initHandheld();
    for (const [keyCode, code] of [[32, "Space"], [16, "ShiftLeft"], [8, "Backspace"]]) {
      press("keydown", keyCode, code);
      expect(lit("select")).toBe(true);
      press("keyup", keyCode, code);
      expect(lit("select")).toBe(false);
    }
  });

  it("turns touches into key events that light the button", async () => {
    await initHandheld();
    const start = document.querySelector('[data-button="start"]');

    start.dispatchEvent(pointer("pointerdown"));
    expect(events).toContain("down:Enter");
    expect(lit("start")).toBe(true);

    start.dispatchEvent(pointer("pointerup"));
    expect(events).toContain("up:Enter");
    expect(lit("start")).toBe(false);
  });

  it("releases held buttons when the window loses focus", async () => {
    await initHandheld();
    document.querySelector('[data-button="a"]').dispatchEvent(pointer("pointerdown"));
    events.length = 0;
    window.dispatchEvent(new Event("blur"));
    expect(events).toContain("up:KeyX");
    expect(lit("a")).toBe(false);
  });

  it("blocks text selection and context menus", async () => {
    await initHandheld();
    const event = new Event("selectstart", { bubbles: true, cancelable: true });
    document.body.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("keeps the on-screen controls working if the package cannot be loaded", async () => {
    vi.resetModules();
    vi.doMock("multi-key-handler", () => {
      throw new Error("offline");
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fresh = await import("../rom/handheld.js");

    await expect(fresh.initHandheld()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();

    document.querySelector('[data-button="b"]').dispatchEvent(pointer("pointerdown"));
    expect(events).toContain("down:KeyZ");
    vi.doUnmock("multi-key-handler");
  });
});
