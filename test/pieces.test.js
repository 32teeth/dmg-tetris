import { describe, expect, it } from "vitest";
import { BLOCKS, NEXT_PREVIEW, PIECES, T, cellTile } from "../rom/tetris.js";

describe("PIECES", () => {
  it("has the seven tetrominoes in ROM order (L J I O Z S T)", () => {
    expect(PIECES.map(p => p.id)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(Object.isFrozen(PIECES[0])).toBe(true);
  });

  it("gives every piece four orientations of four cells inside a 4x4 box", () => {
    for (const piece of PIECES) {
      expect(piece.states).toHaveLength(4);
      for (const cells of piece.states) {
        expect(cells).toHaveLength(4);
        expect(new Set(cells.map(String)).size).toBe(4);
        for (const [x, y] of cells) {
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x).toBeLessThan(4);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(y).toBeLessThan(4);
        }
      }
    }
  });

  it("keeps the O piece the same in every orientation", () => {
    const o = PIECES[3];
    expect(o.states.every(cells => cells === o.states[0])).toBe(true);
  });

  it("repeats two shapes for I, S and Z", () => {
    for (const id of [2, 4, 5]) {
      const { states } = PIECES[id];
      expect(states[0]).toBe(states[2]);
      expect(states[1]).toBe(states[3]);
    }
  });
});

describe("cellTile", () => {
  it("uses the piece's own block tile", () => {
    expect(cellTile(PIECES[0], 0, 0)).toBe(0);
    expect(cellTile(PIECES[6], 3, 2)).toBe(6);
  });

  it("uses end caps and body tiles for the I piece", () => {
    const i = PIECES[2];
    expect([0, 1, 2, 3].map(n => cellTile(i, 0, n))).toEqual([7, 8, 8, 9]);
    expect([0, 1, 2, 3].map(n => cellTile(i, 1, n))).toEqual([10, 11, 11, 12]);
  });
});

describe("NEXT_PREVIEW", () => {
  it("centres each piece in the NEXT box", () => {
    // The O piece is 2x2, so it sits one tile in from the box's 4x4 corner at (15, 13).
    expect(NEXT_PREVIEW[3].map(({ x, y }) => [x, y])).toEqual([
      [15 * T + T, 13 * T + T],
      [15 * T + 2 * T, 13 * T + T],
      [15 * T + T, 13 * T + 2 * T],
      [15 * T + 2 * T, 13 * T + 2 * T],
    ]);
  });

  it("previews the I piece with its cap and body tiles, flat on its box row", () => {
    const preview = NEXT_PREVIEW[2];
    expect(preview.map(p => p.tile)).toEqual([BLOCKS[7], BLOCKS[8], BLOCKS[8], BLOCKS[9]]);
    expect(new Set(preview.map(p => p.y)).size).toBe(1);
  });
});
