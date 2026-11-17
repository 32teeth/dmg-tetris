import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fills, frame, frames, makeApp } from "./helpers.js";
import { LevelScene, PALETTE, PlayScene, Screen, TitleScene } from "../rom/tetris.js";

const newScreen = () => {
  const canvas = document.createElement("canvas");
  return { screen: new Screen(canvas), ctx: canvas.context };
};

describe("TitleScene", () => {
  it("waits for Start, then goes to level select", () => {
    const ctx = makeApp();
    const title = new TitleScene();

    frame(title, ctx);
    expect(ctx.app.go).not.toHaveBeenCalled();

    frame(title, ctx, ["start"]);
    expect(ctx.sfx).toEqual(["start"]);
    expect(ctx.app.scene).toBeInstanceOf(LevelScene);
  });

  it("draws the title picture over the whole screen", () => {
    const { screen, ctx } = newScreen();
    new TitleScene().draw(screen);
    expect(ctx.calls).toEqual([["drawImage", expect.anything(), 0, 0]]);
  });
});

describe("LevelScene", () => {
  const setup = (level = 0) => {
    const ctx = makeApp();
    ctx.app.options.level = level;
    return { ctx, scene: new LevelScene() };
  };

  it("moves the selection with left and right, within 0-9", () => {
    const { ctx, scene } = setup(0);
    frame(scene, ctx, ["left"]);
    expect(ctx.app.options.level).toBe(0);
    frame(scene, ctx, ["right"]);
    expect(ctx.app.options.level).toBe(1);

    ctx.app.options.level = 9;
    frame(scene, ctx, ["right"]);
    expect(ctx.app.options.level).toBe(9);
    frame(scene, ctx, ["left"]);
    expect(ctx.app.options.level).toBe(8);
    expect(ctx.sfx).toContain("select");
  });

  it("jumps between the two rows with down and up", () => {
    const { ctx, scene } = setup(3);
    frame(scene, ctx, ["down"]);
    expect(ctx.app.options.level).toBe(8);
    frame(scene, ctx, ["down"]);
    expect(ctx.app.options.level).toBe(8);
    frame(scene, ctx, ["up"]);
    expect(ctx.app.options.level).toBe(3);
    frame(scene, ctx, ["up"]);
    expect(ctx.app.options.level).toBe(3);
  });

  it("starts the game at the chosen level with Start or A", () => {
    for (const button of ["start", "a"]) {
      const { ctx, scene } = setup(4);
      frame(scene, ctx, [button]);
      expect(ctx.app.scene).toBeInstanceOf(PlayScene);
      expect(ctx.app.scene.level).toBe(4);
      expect(ctx.sfx).toContain("start");
    }
  });

  it("adds ten levels when Start is pressed with A held", () => {
    const { ctx, scene } = setup(4);
    ctx.held.add("a");
    frame(scene, ctx, ["start"]);
    expect(ctx.app.scene.level).toBe(14);
  });

  it("goes back to the title with B", () => {
    const { ctx, scene } = setup();
    frame(scene, ctx, ["b"]);
    expect(ctx.app.scene).toBeInstanceOf(TitleScene);
  });

  it("blinks the selected digit", () => {
    const { ctx, scene } = setup(2);
    const digitAt = (calls, x, y) => calls.find(c => c[0] === "drawImage" && c[2] === x && c[3] === y)[1];
    const draw = () => {
      const { screen, ctx: canvas } = newScreen();
      scene.draw(screen, ctx.app);
      return canvas.calls;
    };

    // Level 2 sits in the first row, third cell: x = 68 + 2, y = 47.
    const lit = digitAt(draw(), 70, 47);
    frames(scene, ctx, 16);
    const blinked = digitAt(draw(), 70, 47);
    expect(blinked).not.toBe(lit);
    frames(scene, ctx, 16);
    expect(digitAt(draw(), 70, 47)).toBe(lit);
  });
});

// ---------------------------------------------------------------- PlayScene

// Math.random() = 0.3 always picks the I piece (index 2 of 7), so every spawn is an I.
beforeEach(() => vi.spyOn(Math, "random").mockReturnValue(0.3));
afterEach(() => vi.restoreAllMocks());

const newGame = (level = 0) => {
  const ctx = makeApp();
  ctx.app.options.level = level;
  return { ctx, scene: new PlayScene(ctx.app, level) };
};

const untilSpawn = (scene, ctx) => {
  for (let n = 0; !scene.current; n++) {
    if (n > 500) throw new Error("no piece spawned");
    frame(scene, ctx);
  }
};

const untilLocked = (scene, ctx, limit = 5000) => {
  for (let n = 0; scene.current; n++) {
    if (n > limit) throw new Error("piece never locked");
    frame(scene, ctx);
  }
};

const nudge = (scene, ctx, dir) => {
  ctx.held.add(dir);
  frame(scene, ctx, [dir]);
  ctx.held.delete(dir);
};

// Drops an I piece, flat or standing, so it ends up at `col` (its leftmost column).
const dropI = (scene, ctx, { tall = false, col }) => {
  untilSpawn(scene, ctx);
  if (tall) frame(scene, ctx, ["a"]);
  const x = tall ? col - 1 : col;
  while (scene.current.x !== x) nudge(scene, ctx, scene.current.x < x ? "right" : "left");
  untilLocked(scene, ctx);
};

const settle = (scene, ctx) => frames(scene, ctx, 100);

describe("PlayScene", () => {
  it("starts empty with the chosen level, then spawns a piece after a short entry delay", () => {
    const { ctx, scene } = newGame(7);
    expect([scene.state, scene.score, scene.lines, scene.level]).toEqual(["entry", 0, 0, 7]);
    expect(scene.current).toBeNull();

    frames(scene, ctx, 2);
    expect(scene.current).toBeNull();
    frame(scene, ctx);
    expect(scene.state).toBe("fall");
    expect(scene.current).toEqual({ id: 2, rot: 0, x: 3, y: -2 });
  });

  it("drops the piece one row every gravity + 1 frames", () => {
    const { ctx, scene } = newGame(9); // gravity 10
    untilSpawn(scene, ctx);
    frames(scene, ctx, 10);
    expect(scene.current.y).toBe(-2);
    frame(scene, ctx);
    expect(scene.current.y).toBe(-1);
    frames(scene, ctx, 11);
    expect(scene.current.y).toBe(0);
  });

  it("slides the piece one cell per press and stops at the walls", () => {
    const { ctx, scene } = newGame();
    untilSpawn(scene, ctx);
    for (let n = 0; n < 5; n++) nudge(scene, ctx, "left");
    expect(scene.current.x).toBe(0);
    expect(ctx.sfx.filter(s => s === "move")).toHaveLength(3);

    for (let n = 0; n < 8; n++) nudge(scene, ctx, "right");
    expect(scene.current.x).toBe(6);
  });

  it("auto-repeats a held direction after the DAS delay", () => {
    const { ctx, scene } = newGame();
    untilSpawn(scene, ctx);
    ctx.held.add("left");
    frame(scene, ctx, ["left"]);
    expect(scene.current.x).toBe(2);

    frames(scene, ctx, 22);
    expect(scene.current.x).toBe(2);
    frame(scene, ctx);
    expect(scene.current.x).toBe(1);
    frames(scene, ctx, 8);
    expect(scene.current.x).toBe(1);
    frame(scene, ctx);
    expect(scene.current.x).toBe(0);

    // Pushing into the wall keeps trying without moving or making noise.
    const moves = ctx.sfx.filter(s => s === "move").length;
    frames(scene, ctx, 30);
    expect(scene.current.x).toBe(0);
    expect(ctx.sfx.filter(s => s === "move")).toHaveLength(moves);
  });

  it("rotates with A one way and B the other", () => {
    const { ctx, scene } = newGame();
    untilSpawn(scene, ctx);
    frame(scene, ctx, ["b"]);
    expect(scene.current.rot).toBe(1);
    frame(scene, ctx, ["a"]);
    expect(scene.current.rot).toBe(0);
    frame(scene, ctx, ["a"]);
    expect(scene.current.rot).toBe(3);
    expect(ctx.sfx.filter(s => s === "rotate")).toHaveLength(3);
  });

  it("does not kick off walls: a blocked rotation is dropped", () => {
    const { ctx, scene } = newGame();
    untilSpawn(scene, ctx);
    frame(scene, ctx, ["b"]); // standing
    for (let n = 0; n < 5; n++) nudge(scene, ctx, "right");
    expect(scene.current.x).toBe(8);

    const rotations = ctx.sfx.filter(s => s === "rotate").length;
    frame(scene, ctx, ["b"]); // lying flat would need x 8-11
    expect(scene.current.rot).toBe(1);
    expect(ctx.sfx.filter(s => s === "rotate")).toHaveLength(rotations);
  });

  it("soft-drops one row every three frames while Down is held, and scores the cells", () => {
    const { ctx, scene } = newGame();
    untilSpawn(scene, ctx);
    ctx.held.add("down");
    frame(scene, ctx, ["down"]);
    expect(scene.current.y).toBe(-1);
    frames(scene, ctx, 2);
    expect(scene.current.y).toBe(-1);
    frame(scene, ctx);
    expect(scene.current.y).toBe(0);

    while (scene.current) frame(scene, ctx);
    ctx.held.delete("down");
    expect(scene.score).toBe(17);
    expect(ctx.sfx).toContain("lock");
  });

  it("needs a fresh Down press for the next piece after a lock", () => {
    const { ctx, scene } = newGame();
    untilSpawn(scene, ctx);
    ctx.held.add("down");
    while (scene.current) frame(scene, ctx, ["down"]);

    for (let n = 0; n < 5; n++) frame(scene, ctx);
    untilSpawn(scene, ctx);
    const { y } = scene.current;
    frames(scene, ctx, 10);
    expect(scene.current.y).toBe(y); // still held, never re-pressed: gravity is slower than this
    frame(scene, ctx, ["down"]);
    expect(scene.current.y).toBe(y + 1);
  });

  it("ignores Down while a sideways button is held", () => {
    const { ctx, scene } = newGame();
    untilSpawn(scene, ctx);
    ctx.held.add("down");
    ctx.held.add("left");
    frame(scene, ctx, ["down", "left"]);
    expect(scene.current.y).toBe(-2);
  });

  describe("clearing lines", () => {
    // Four pieces that fill the bottom row exactly: two flat, two standing.
    const fillBottomRow = (scene, ctx) => {
      dropI(scene, ctx, { col: 0 });
      dropI(scene, ctx, { col: 4 });
      dropI(scene, ctx, { tall: true, col: 8 });
      dropI(scene, ctx, { tall: true, col: 9 });
    };

    it("flashes the full row, then collapses it and scores 40 x (level + 1)", () => {
      const { ctx, scene } = newGame(9);
      fillBottomRow(scene, ctx);
      expect(scene.state).toBe("clear");
      expect(ctx.sfx.at(-1)).toBe("clear");
      expect(scene.score).toBe(0);

      settle(scene, ctx);
      expect(scene.lines).toBe(1);
      expect(scene.score).toBe(400);
      expect(scene.state).not.toBe("clear");
    });

    it("scores a Tetris with its own jingle", () => {
      const { ctx, scene } = newGame(2);
      for (let col = 0; col < 9; col++) dropI(scene, ctx, { tall: true, col });
      dropI(scene, ctx, { tall: true, col: 9 });
      expect(ctx.sfx.at(-1)).toBe("tetris");
      settle(scene, ctx);
      expect(scene.lines).toBe(4);
      expect(scene.score).toBe(1200 * 3);
    });

    it("raises the level every ten lines", () => {
      const { ctx, scene } = newGame(0);
      const oneLine = (withStandingPieces) => {
        dropI(scene, ctx, { col: 0 });
        dropI(scene, ctx, { col: 4 });
        if (withStandingPieces) {
          dropI(scene, ctx, { tall: true, col: 8 });
          dropI(scene, ctx, { tall: true, col: 9 });
        }
        settle(scene, ctx);
      };

      // The standing pieces leave a shrinking stack that later flat pairs clear one row at a time.
      for (let round = 0; round < 3; round++) {
        oneLine(true);
        oneLine(false);
        oneLine(false);
        oneLine(false);
      }
      expect(scene.lines).toBe(12);
      expect(scene.level).toBe(1);
      expect(ctx.sfx).toContain("levelup");
      // Lines 1-10 at level 0 (40 each), then lines 11-12 at level 1 (80 each).
      expect(scene.score).toBe(10 * 40 + 2 * 80);
    });

    it("flashes the cleared row, then blanks it before it collapses", () => {
      const { ctx, scene } = newGame(9);
      fillBottomRow(scene, ctx);
      const rowTiles = () => {
        const { screen, ctx: canvas } = newScreen();
        scene.draw(screen, ctx.app);
        return canvas.calls.filter(c => c[0] === "drawImage" && c[3] === 17 * 8 && c[2] >= 16 && c[2] < 96);
      };

      frames(scene, ctx, 3); // flashing starts after 3 frames
      const flash = rowTiles();
      expect(flash).toHaveLength(10);
      expect(new Set(flash.map(c => c[1])).size).toBe(1);

      frames(scene, ctx, 10); // back to the real blocks
      expect(new Set(rowTiles().map(c => c[1])).size).toBeGreaterThan(1);

      frames(scene, ctx, 50); // after three flashes the row is blank
      expect(rowTiles()).toHaveLength(0);
    });
  });

  describe("pausing", () => {
    it("freezes the game with Start and resumes with Start", () => {
      const { ctx, scene } = newGame(9);
      untilSpawn(scene, ctx);
      frame(scene, ctx, ["start"]);
      expect(scene.paused).toBe(true);
      expect(ctx.sfx.at(-1)).toBe("pause");

      const { y } = scene.current;
      frames(scene, ctx, 60);
      expect(scene.current.y).toBe(y);

      frame(scene, ctx, ["start"]);
      expect(scene.paused).toBe(false);
      frames(scene, ctx, 60);
      expect(scene.current.y).toBeGreaterThan(y);
    });

    it("draws PAUSE instead of the playfield", () => {
      const { ctx, scene } = newGame();
      untilSpawn(scene, ctx);
      const draw = () => {
        const { screen, ctx: canvas } = newScreen();
        scene.draw(screen, ctx.app);
        return canvas.calls;
      };
      const running = draw();
      frame(scene, ctx, ["start"]);
      const paused = draw();

      expect(paused.filter(c => c[0] === "fillRect").length).toBeGreaterThan(0);
      expect(paused.filter(c => c[0] === "drawImage").length).toBeLessThan(
        running.filter(c => c[0] === "drawImage").length,
      );
    });
  });

  it("hides and shows the NEXT piece with Select", () => {
    const { ctx, scene } = newGame();
    untilSpawn(scene, ctx);
    const images = () => {
      const { screen, ctx: canvas } = newScreen();
      scene.draw(screen, ctx.app);
      return canvas.calls.filter(c => c[0] === "drawImage").length;
    };

    const shown = images();
    frame(scene, ctx, ["select"]);
    expect(images()).toBe(shown - 4);
    frame(scene, ctx, ["select"]);
    expect(images()).toBe(shown);
  });

  describe("game over", () => {
    // Flat I pieces soft-dropped on top of each other until the stack reaches the spawn point.
    const stackToTheTop = (scene, ctx) => {
      ctx.held.add("down");
      for (let n = 0; scene.state !== "curtain"; n++) {
        if (n > 20000) throw new Error("never topped out");
        frame(scene, ctx, ["down"]);
      }
      ctx.held.delete("down");
    };

    it("covers the field with a curtain that rises, holds, then falls away", () => {
      const { ctx, scene } = newGame();
      stackToTheTop(scene, ctx);
      expect(ctx.sfx.at(-1)).toBe("gameover");
      expect(scene.current).toBeNull();

      const curtainTiles = () => {
        const { screen, ctx: canvas } = newScreen();
        scene.draw(screen, ctx.app);
        const bottom = canvas.calls.find(c => c[0] === "drawImage" && c[2] === 16 && c[3] === 17 * 8);
        return canvas.calls.filter(c => c[0] === "drawImage" && c[1] === bottom[1]).length;
      };

      frames(scene, ctx, 5);
      expect(curtainTiles()).toBe(5 * 10);
      frames(scene, ctx, 70);
      expect(scene.state).toBe("curtain");
      frames(scene, ctx, 20);
      expect(scene.state).toBe("over");
    });

    it("shows the game-over box and message, with the NEXT window empty", () => {
      const { ctx, scene } = newGame();
      stackToTheTop(scene, ctx);
      frames(scene, ctx, 90);
      expect(scene.state).toBe("over");

      const { screen, ctx: canvas } = newScreen();
      scene.draw(screen, ctx.app);

      const light = fills(canvas, PALETTE[1]);
      expect(light).toContainEqual([40, 40, 32, 1]); // underline under GAME
      expect(light).toContainEqual([40, 56, 32, 1]); // underline under OVER
      expect(fills(canvas, PALETTE[3])).toContainEqual([24, 104, 1, 1]); // dotted underline under PLEASE
      expect(canvas.calls).toContainEqual(["drawImage", expect.objectContaining({ width: 7 }), 80, 129]); // the heart

      const nextBoxTiles = canvas.calls.filter(c => c[0] === "drawImage" && c[2] >= 15 * 8 && c[3] >= 13 * 8);
      expect(nextBoxTiles).toHaveLength(0);
    });

    it("goes back to level select on Start or A", () => {
      for (const button of ["start", "a"]) {
        const { ctx, scene } = newGame();
        stackToTheTop(scene, ctx);
        frames(scene, ctx, 90);
        frame(scene, ctx, [button]);
        expect(ctx.app.scene).toBeInstanceOf(LevelScene);
      }
    });

    it("cannot be paused once the game has ended", () => {
      const { ctx, scene } = newGame();
      stackToTheTop(scene, ctx);
      frame(scene, ctx, ["start"]);
      expect(scene.paused).toBe(false);
    });
  });
});
