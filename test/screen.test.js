import { describe, expect, it } from "vitest";
import { COLORS } from "./setup.js";
import { FRAME_MS, H, PALETTE, Screen, T, W } from "../rom/tetris.js";

const setup = () => {
  const canvas = document.createElement("canvas");
  const screen = new Screen(canvas);
  return { canvas, screen, ctx: canvas.context };
};

describe("palette", () => {
  it("is read from the --gb-* CSS variables, lightest first", () => {
    expect(PALETTE).toEqual(COLORS);
  });
});

describe("timing", () => {
  it("runs at the Game Boy's 59.73 Hz refresh", () => {
    expect(1000 / FRAME_MS).toBeCloseTo(59.7275, 3);
  });
});

describe("Screen", () => {
  it("sizes the canvas to the 160x144 LCD with smoothing off", () => {
    const { canvas, ctx } = setup();
    expect([canvas.width, canvas.height]).toEqual([W, H]);
    expect(ctx.imageSmoothingEnabled).toBe(false);
  });

  it("fills rectangles with a palette shade, darkest by default", () => {
    const { screen, ctx } = setup();
    screen.rect(1, 2, 3, 4);
    screen.rect(5, 6, 7, 8, 0);
    expect(ctx.calls).toEqual([
      ["fillRect", PALETTE[3], 1, 2, 3, 4],
      ["fillRect", PALETTE[0], 5, 6, 7, 8],
    ]);
  });

  it("draws tiles on the 8px grid and images at pixel positions", () => {
    const { screen, ctx } = setup();
    const img = {};
    screen.tile(img, 3, 2);
    screen.tilePx(img, 5, 7);
    expect(ctx.calls).toEqual([
      ["drawImage", img, 3 * T, 2 * T],
      ["drawImage", img, 5, 7],
    ]);
  });

  it("draws a glyph one lit pixel at a time, offset by one column", () => {
    const { screen, ctx } = setup();
    screen.glyph("-", 10, 20, 2, 1);
    expect(ctx.calls).toHaveLength(5);
    expect(ctx.calls.map(c => c.slice(2))).toEqual([1, 2, 3, 4, 5].map(c => [10 + c, 23, 1, 1]));
    expect(ctx.calls.every(c => c[1] === PALETTE[2])).toBe(true);
  });

  it("scales glyph pixels", () => {
    const { screen, ctx } = setup();
    screen.glyph("-", 0, 0, 3, 2);
    expect(ctx.calls[0].slice(2)).toEqual([2, 6, 2, 2]);
  });

  it("skips characters the font does not have", () => {
    const { screen, ctx } = setup();
    screen.glyph("~", 0, 0, 3, 1);
    expect(ctx.calls).toEqual([]);
  });

  it("advances one 8px cell per character", () => {
    const { screen, ctx } = setup();
    screen.text("--", 0, 0);
    const xs = new Set(ctx.calls.map(c => c[2]));
    expect(xs).toEqual(new Set([1, 2, 3, 4, 5, 9, 10, 11, 12, 13]));
  });

  it("centres text within a span", () => {
    const { screen, ctx } = setup();
    screen.center("-", 0, 3, 1, 16, 80);
    // (80 - 8) / 2 = 36 into a span starting at 16
    expect(ctx.calls[0][2]).toBe(16 + 36 + 1);
  });

  it("draws bold text by overstriking each glyph one pixel to the right", () => {
    const { screen, ctx } = setup();
    screen.boldText("-", 0, 0);
    expect(ctx.calls).toHaveLength(10);
    expect(new Set(ctx.calls.map(c => c[2]))).toEqual(new Set([1, 2, 3, 4, 5, 6]));
  });

  it("draws the heart as an image instead of a glyph", () => {
    const { screen, ctx } = setup();
    screen.boldText("-♥", 0, 0);
    const [, heart, x, y] = ctx.calls.find(c => c[0] === "drawImage");
    expect([x, y]).toEqual([8, 0]);
    expect(heart.width).toBe(7);
  });

  it("outlines a box with notched corners", () => {
    const { screen, ctx } = setup();
    screen.box(1, 1, 3, 2);
    // x = 8 + 3, y = 8 + 3, width = 24 - 6, height = 16 - 6
    expect(ctx.calls.map(c => c.slice(2))).toEqual([
      [12, 11, 16, 1],
      [12, 20, 16, 1],
      [11, 12, 1, 8],
      [28, 12, 1, 8],
    ]);
  });
});
