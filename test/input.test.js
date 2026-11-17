import { afterEach, describe, expect, it, vi } from "vitest";
import { Input, KEYMAP } from "../rom/tetris.js";

const key = (type, code, init = {}) => {
  const event = new KeyboardEvent(type, { code, bubbles: true, cancelable: true, ...init });
  window.dispatchEvent(event);
  return event;
};

describe("Input", () => {
  let input;
  const make = (onGesture = () => {}) => (input = new Input(onGesture));

  afterEach(() => window.dispatchEvent(new Event("blur")));

  it.each([
    ["ArrowLeft", "left"],
    ["ArrowRight", "right"],
    ["ArrowUp", "up"],
    ["ArrowDown", "down"],
    ["KeyX", "a"],
    ["KeyZ", "b"],
    ["Enter", "start"],
    ["Space", "select"],
    ["ShiftLeft", "select"],
    ["ShiftRight", "select"],
    ["Backspace", "select"],
  ])("maps %s to %s", (code, button) => {
    expect(KEYMAP[code]).toBe(button);
    make();
    key("keydown", code);
    expect(input.held(button)).toBe(true);
    key("keyup", code);
    expect(input.held(button)).toBe(false);
  });

  it("no longer treats Space as A", () => {
    expect(KEYMAP.Space).not.toBe("a");
  });

  it("claims mapped keys so the page does not scroll or select", () => {
    make();
    expect(key("keydown", "Space").defaultPrevented).toBe(true);
    expect(key("keyup", "Space").defaultPrevented).toBe(true);
  });

  it("ignores unmapped keys", () => {
    const onGesture = vi.fn();
    make(onGesture);
    expect(key("keydown", "KeyQ").defaultPrevented).toBe(false);
    expect(key("keyup", "KeyQ").defaultPrevented).toBe(false);
    expect(onGesture).not.toHaveBeenCalled();
  });

  it("leaves browser shortcuts alone", () => {
    make();
    for (const modifier of ["metaKey", "ctrlKey", "altKey"]) {
      const event = key("keydown", "KeyX", { [modifier]: true });
      expect(event.defaultPrevented).toBe(false);
      expect(input.held("a")).toBe(false);
    }
  });

  it("reports a press once, on the poll after the key went down", () => {
    make();
    key("keydown", "KeyX");
    expect(input.pressed("a")).toBe(false);
    input.poll();
    expect(input.pressed("a")).toBe(true);
    input.poll();
    expect(input.pressed("a")).toBe(false);
    expect(input.held("a")).toBe(true);
  });

  it("ignores key auto-repeat", () => {
    make();
    key("keydown", "KeyX");
    input.poll();
    input.poll();
    key("keydown", "KeyX", { repeat: true });
    input.poll();
    expect(input.pressed("a")).toBe(false);
  });

  it("still reports a quick tap that was released before the poll", () => {
    make();
    key("keydown", "Enter");
    key("keyup", "Enter");
    input.poll();
    expect(input.pressed("start")).toBe(true);
    expect(input.held("start")).toBe(false);
  });

  it("counts key presses and releases as user gestures (to unlock audio)", () => {
    const onGesture = vi.fn();
    make(onGesture);
    key("keydown", "KeyZ");
    key("keyup", "KeyZ");
    expect(onGesture).toHaveBeenCalledTimes(2);
  });

  it("drops held buttons when the window loses focus", () => {
    make();
    key("keydown", "ArrowLeft");
    window.dispatchEvent(new Event("blur"));
    expect(input.held("left")).toBe(false);
  });
});
