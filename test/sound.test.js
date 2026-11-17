import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SFX, Sound } from "../rom/tetris.js";

let contexts;

class FakeAudioContext {
  constructor() {
    this.state = "suspended";
    this.currentTime = 10;
    this.destination = { id: "destination" };
    this.oscillators = [];
    this.gains = [];
    this.resume = vi.fn(() => {
      this.state = "running";
    });
    contexts.push(this);
  }

  createGain() {
    const node = {
      gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
      connect: vi.fn(target => target),
    };
    this.gains.push(node);
    return node;
  }

  createOscillator() {
    const osc = {
      frequency: {},
      connect: vi.fn(target => target),
      start: vi.fn(),
      stop: vi.fn(),
    };
    this.oscillators.push(osc);
    return osc;
  }
}

beforeEach(() => {
  contexts = [];
  vi.stubGlobal("AudioContext", FakeAudioContext);
});

afterEach(() => vi.unstubAllGlobals());

describe("Sound", () => {
  it("stays silent until a user gesture unlocks it", () => {
    const sound = new Sound();
    expect(sound.ready).toBe(false);
    expect(() => sound.sfx("move")).not.toThrow();
    expect(contexts).toHaveLength(0);
  });

  it("creates one audio context at half volume and resumes it", () => {
    const sound = new Sound();
    sound.unlock();
    expect(sound.ready).toBe(true);
    expect(contexts).toHaveLength(1);
    expect(contexts[0].resume).toHaveBeenCalledOnce();
    expect(sound.now).toBe(10);
    expect(contexts[0].gains[0].gain.value).toBe(0.5);
    expect(contexts[0].gains[0].connect).toHaveBeenCalledWith(contexts[0].destination);

    sound.unlock();
    expect(contexts).toHaveLength(1);
    expect(contexts[0].resume).toHaveBeenCalledOnce();
  });

  it("resumes a context the browser suspended again", () => {
    const sound = new Sound();
    sound.unlock();
    contexts[0].state = "suspended";
    sound.unlock();
    expect(contexts[0].resume).toHaveBeenCalledTimes(2);
  });

  it("plays a sound effect as a run of square-wave tones", () => {
    const sound = new Sound();
    sound.unlock();
    sound.sfx("clear");

    const { oscillators } = contexts[0];
    expect(oscillators.map(o => o.frequency.value)).toEqual(SFX.clear.map(([f]) => f));
    expect(oscillators.every(o => o.type === "square")).toBe(true);

    // Each tone starts when the previous one ends.
    const starts = oscillators.map(o => o.start.mock.calls[0][0]);
    expect(starts[0]).toBe(10);
    expect(starts[1]).toBeCloseTo(10 + SFX.clear[0][1]);
    expect(oscillators[0].stop.mock.calls[0][0]).toBeCloseTo(10 + SFX.clear[0][1] + 0.02);
  });

  it("treats a zero frequency as a rest", () => {
    const sound = new Sound();
    sound.unlock();
    sound.sfx("pause");
    const { oscillators } = contexts[0];
    expect(oscillators).toHaveLength(2);
    expect(oscillators[1].start.mock.calls[0][0]).toBeCloseTo(10 + 0.06 + 0.03);
  });

  it("fades each tone out at the end", () => {
    const sound = new Sound();
    sound.unlock();
    const gain = { gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }, connect: vi.fn(t => t) };
    contexts[0].createGain = () => gain;
    sound.tone(440, 1, 0.5);
    expect(gain.gain.setValueAtTime).toHaveBeenCalledWith(0.06, 1);
    expect(gain.gain.setValueAtTime).toHaveBeenCalledWith(0.06, 1.4);
    expect(gain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 1.5);
  });

  it("has an effect for every sound the game asks for", () => {
    expect(Object.keys(SFX).sort()).toEqual(
      ["clear", "gameover", "levelup", "lock", "move", "pause", "rotate", "select", "start", "tetris"].sort(),
    );
  });
});
