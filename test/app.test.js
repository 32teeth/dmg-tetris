import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App, FRAME_MS, TitleScene } from "../rom/tetris.js";

let queue;
let now;

beforeEach(() => {
  queue = [];
  now = 0;
  vi.stubGlobal("requestAnimationFrame", callback => queue.push(callback));
  vi.spyOn(performance, "now").mockImplementation(() => now);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.documentElement.removeAttribute("data-suspended");
});

const makeApp = () => {
  const app = new App(document.createElement("canvas"));
  app.scene = { update: vi.fn(), draw: vi.fn() };
  vi.spyOn(app.input, "poll");
  return app;
};

// Fires the pending animation frame at time `t`.
const tick = t => queue.shift()(t);

describe("App", () => {
  it("starts on the title screen at level 0", () => {
    const app = new App(document.createElement("canvas"));
    expect(app.scene).toBeInstanceOf(TitleScene);
    expect(app.options).toEqual({ level: 0 });
  });

  it("switches scenes", () => {
    const app = makeApp();
    const next = {};
    app.go(next);
    expect(app.scene).toBe(next);
  });

  it("unlocks audio on the first key press", () => {
    vi.stubGlobal(
      "AudioContext",
      class {
        state = "running";
        destination = {};
        createGain = () => ({ gain: {}, connect: () => {} });
      },
    );
    const app = makeApp();
    expect(app.sound.ready).toBe(false);
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyX" }));
    expect(app.sound.ready).toBe(true);
  });

  describe("run", () => {
    it("steps the scene once per 59.73 Hz frame and keeps asking for the next animation frame", () => {
      const app = makeApp();
      app.run();
      expect(queue).toHaveLength(1);

      tick(FRAME_MS * 3.5);
      expect(app.scene.update).toHaveBeenCalledTimes(3);
      expect(app.input.poll).toHaveBeenCalledTimes(3);
      expect(app.scene.update).toHaveBeenCalledWith(app);
      expect(queue).toHaveLength(1);
    });

    it("carries leftover time into the next frame", () => {
      const app = makeApp();
      app.run();
      tick(FRAME_MS * 1.5);
      expect(app.scene.update).toHaveBeenCalledTimes(1);
      tick(FRAME_MS * 2.5);
      expect(app.scene.update).toHaveBeenCalledTimes(2);
    });

    it("only repaints after the scene has stepped", () => {
      const app = makeApp();
      app.run();
      tick(FRAME_MS * 0.5); // first paint, nothing stepped yet
      expect(app.scene.draw).toHaveBeenCalledTimes(1);
      tick(FRAME_MS * 1.2);
      expect(app.scene.update).toHaveBeenCalledTimes(1);
      expect(app.scene.draw).toHaveBeenCalledTimes(2);
      tick(FRAME_MS * 1.9);
      expect(app.scene.update).toHaveBeenCalledTimes(1);
      expect(app.scene.draw).toHaveBeenCalledTimes(2);
      expect(app.scene.draw).toHaveBeenCalledWith(app.screen, app);
    });

    it("never catches up more than 250ms after a stall", () => {
      const app = makeApp();
      app.run();
      tick(60_000);
      expect(app.scene.update).toHaveBeenCalledTimes(Math.floor(250 / FRAME_MS));
    });

    it("freezes while the page marks the game as suspended, and resumes without a jump", () => {
      const app = makeApp();
      app.run();
      document.documentElement.setAttribute("data-suspended", "");
      tick(5_000);
      tick(10_000);
      expect(app.scene.update).not.toHaveBeenCalled();
      expect(app.scene.draw).not.toHaveBeenCalled();
      expect(queue).toHaveLength(1);

      document.documentElement.removeAttribute("data-suspended");
      tick(10_000 + FRAME_MS * 1.1);
      expect(app.scene.update).toHaveBeenCalledTimes(1);
    });
  });
});
