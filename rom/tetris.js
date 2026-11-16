"use strict";

// ---------------------------------------------------------------- constants

const W = 160, H = 144, T = 8;
const FIELD_COLS = 10, FIELD_ROWS = 18, FIELD_COL0 = 2, FIELD_X = FIELD_COL0 * T;
const FRAME_MS = 1000 / (4194304 / 70224); // 59.7275 Hz LCD refresh

// Timings from the original ROM: a piece moves down every GRAVITY[level] + 1 frames.
const DAS_DELAY = 23, DAS_REPEAT = 9, SOFT_DROP_FRAMES = 3;
const ENTRY_FRAMES = 3, FLASH_START = 3, FLASH_STEP = 10, SHIFT_FRAMES = 18;
const GRAVITY = [52, 48, 44, 40, 36, 32, 27, 21, 16, 10, 9, 8, 7, 6, 5, 5, 4, 4, 3, 3, 2];
const MAX_LEVEL = 20;
const LINE_SCORE = [0, 40, 100, 300, 1200];
const SPAWN_X = 3, SPAWN_Y = -2;

const css = getComputedStyle(document.documentElement);
const PALETTE = [0, 1, 2, 3].map(i => css.getPropertyValue(`--gb-${i}`).trim());

// ---------------------------------------------------------------- font (5x7 glyphs on an 8x8 cell)

const FONT = Object.fromEntries(Object.entries({
  A: "01110 10001 10001 11111 10001 10001 10001",
  B: "11110 10001 10001 11110 10001 10001 11110",
  C: "01110 10001 10000 10000 10000 10001 01110",
  D: "11110 10001 10001 10001 10001 10001 11110",
  E: "11111 10000 10000 11110 10000 10000 11111",
  F: "11111 10000 10000 11110 10000 10000 10000",
  G: "01110 10001 10000 10111 10001 10001 01111",
  H: "10001 10001 10001 11111 10001 10001 10001",
  I: "01110 00100 00100 00100 00100 00100 01110",
  J: "00111 00010 00010 00010 00010 10010 01100",
  K: "10001 10010 10100 11000 10100 10010 10001",
  L: "10000 10000 10000 10000 10000 10000 11111",
  M: "10001 11011 10101 10101 10001 10001 10001",
  N: "10001 11001 10101 10011 10001 10001 10001",
  O: "01110 10001 10001 10001 10001 10001 01110",
  P: "11110 10001 10001 11110 10000 10000 10000",
  Q: "01110 10001 10001 10001 10101 10010 01101",
  R: "11110 10001 10001 11110 10100 10010 10001",
  S: "01111 10000 10000 01110 00001 00001 11110",
  T: "11111 00100 00100 00100 00100 00100 00100",
  U: "10001 10001 10001 10001 10001 10001 01110",
  V: "10001 10001 10001 10001 10001 01010 00100",
  W: "10001 10001 10001 10101 10101 11011 10001",
  X: "10001 10001 01010 00100 01010 10001 10001",
  Y: "10001 10001 01010 00100 00100 00100 00100",
  Z: "11111 00001 00010 00100 01000 10000 11111",
  0: "01110 10001 10011 10101 11001 10001 01110",
  1: "00100 01100 00100 00100 00100 00100 01110",
  2: "01110 10001 00001 00010 00100 01000 11111",
  3: "11110 00001 00001 01110 00001 00001 11110",
  4: "00010 00110 01010 10010 11111 00010 00010",
  5: "11111 10000 11110 00001 00001 10001 01110",
  6: "00110 01000 10000 11110 10001 10001 01110",
  7: "11111 00001 00010 00100 01000 01000 01000",
  8: "01110 10001 10001 01110 10001 10001 01110",
  9: "01110 10001 10001 01111 00001 00010 01100",
  "-": "00000 00000 00000 11111 00000 00000 00000",
  ".": "00000 00000 00000 00000 00000 01100 01100",
  "!": "00100 00100 00100 00100 00100 00000 00100",
  ":": "00000 01100 01100 00000 01100 01100 00000",
  "©": "01110 10001 10111 10101 10111 10001 01110",
  ">": "10000 11000 11100 11110 11100 11000 10000",
}).map(([ch, rows]) => [ch, rows.split(" ").map(r => parseInt(r, 2))]));

// ---------------------------------------------------------------- 8x8 tile art (0 = lightest, 3 = darkest)

// Runs of the same shade are filled in one call.
const bake = rows => {
  const canvas = new OffscreenCanvas(rows[0].length, rows.length);
  const g = canvas.getContext("2d");
  rows.forEach((row, y) => {
    for (let x = 0, end; x < row.length; x = end) {
      for (end = x + 1; end < row.length && row[end] === row[x]; end++);
      g.fillStyle = PALETTE[+row[x]];
      g.fillRect(x, y, end - x, 1);
    }
  });
  return canvas;
};

// Indices 0-6 follow the ROM's piece order (L J I O Z S T); 7-12 are the I piece's end caps and body.
const BLOCKS = BLOCK_ART.map(rows => bake(rows));
const DIGITS = DIGIT_ART.map(rows => bake(rows));
const FRAME_TILES = FRAME_ART.map(rows => bake(rows));

// The static play-screen frame (walls, panel, blank field) is composed once.
const FRAME_SCREEN = (() => {
  const canvas = new OffscreenCanvas(W, H);
  const g = canvas.getContext("2d");
  FRAME_MAP.forEach((row, r) => row.forEach((id, c) => g.drawImage(FRAME_TILES[id], c * T, r * T)));
  return canvas;
})();

const TITLE_SCREEN = bake(TITLE_ROWS);
const LEVEL_SCREEN = bake(LEVEL_ROWS);
const LEVEL_DIGITS_PLAIN = DIGIT_PLAIN.map(rows => bake(rows));
const LEVEL_DIGITS_SELECTED = DIGIT_SELECTED.map(rows => bake(rows));

const FLASH = bake(Array(8).fill("22222222"));
const CURTAIN = bake(["32323232", "23232323", "32323232", "23232323", "32323232", "23232323", "32323232", "23232323"]);

// ---------------------------------------------------------------- pieces (no wall kicks, as on the original)

// Each piece has four orientations in a 4x4 box, copied from the ROM's sprite tables.
// Rotating with A steps back through the list, B steps forward; S, Z and I repeat two shapes.
const O_CELLS = [[1, 2], [2, 2], [1, 3], [2, 3]];
const I_FLAT = [[0, 2], [1, 2], [2, 2], [3, 2]];
const I_TALL = [[1, 0], [1, 1], [1, 2], [1, 3]];
const Z_FLAT = [[0, 2], [1, 2], [1, 3], [2, 3]];
const Z_TALL = [[1, 1], [0, 2], [1, 2], [0, 3]];
const S_FLAT = [[1, 2], [2, 2], [0, 3], [1, 3]];
const S_TALL = [[0, 1], [0, 2], [1, 2], [1, 3]];

const PIECES = [
  { // L
    states: [[[0, 2], [1, 2], [2, 2], [0, 3]], [[1, 1], [1, 2], [1, 3], [2, 3]], [[2, 1], [0, 2], [1, 2], [2, 2]], [[0, 1], [1, 1], [1, 2], [1, 3]]],
  },
  { // J
    states: [[[0, 2], [1, 2], [2, 2], [2, 3]], [[1, 1], [2, 1], [1, 2], [1, 3]], [[0, 1], [0, 2], [1, 2], [2, 2]], [[1, 1], [1, 2], [0, 3], [1, 3]]],
  },
  { // I
    states: [I_FLAT, I_TALL, I_FLAT, I_TALL],
    tiles: [[7, 8, 8, 9], [10, 11, 11, 12], [7, 8, 8, 9], [10, 11, 11, 12]],
  },
  { states: [O_CELLS, O_CELLS, O_CELLS, O_CELLS] }, // O
  { states: [Z_FLAT, Z_TALL, Z_FLAT, Z_TALL] },     // Z
  { states: [S_FLAT, S_TALL, S_FLAT, S_TALL] },     // S
  { // T
    states: [[[0, 2], [1, 2], [2, 2], [1, 3]], [[1, 1], [1, 2], [2, 2], [1, 3]], [[1, 1], [0, 2], [1, 2], [2, 2]], [[1, 1], [0, 2], [1, 2], [1, 3]]],
  },
].map((piece, id) => Object.freeze({ id, ...piece }));

const cellTile = (piece, rot, i) => piece.tiles?.[rot][i] ?? piece.id;

// Where each piece's cells land in the NEXT box (interior is tile columns 15-18, rows 13-16).
const NEXT_PREVIEW = PIECES.map(piece => {
  const cells = piece.states[0];
  const xs = cells.map(c => c[0]), ys = cells.map(c => c[1]);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const w = Math.max(...xs) - minX + 1, h = Math.max(...ys) - minY + 1;
  const x0 = 15 * T + ((4 - w) >> 1) * T, y0 = 13 * T + ((4 - h) >> 1) * T;
  return cells.map(([cx, cy], i) => ({ tile: BLOCKS[cellTile(piece, 0, i)], x: x0 + (cx - minX) * T, y: y0 + (cy - minY) * T }));
});

// ---------------------------------------------------------------- screen

class Screen {
  #g;

  constructor(canvas) {
    canvas.width = W;
    canvas.height = H;
    this.#g = canvas.getContext("2d", { alpha: false });
    this.#g.imageSmoothingEnabled = false;
  }

  rect(x, y, w, h, ink = 3) {
    this.#g.fillStyle = PALETTE[ink];
    this.#g.fillRect(x, y, w, h);
  }

  tile(img, col, row) {
    this.#g.drawImage(img, col * T, row * T);
  }

  tilePx(img, x, y) {
    this.#g.drawImage(img, x, y);
  }

  glyph(ch, x, y, ink, scale) {
    const rows = FONT[ch];
    if (!rows) return;
    this.#g.fillStyle = PALETTE[ink];
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 5; c++) {
        if (rows[r] & (16 >> c)) this.#g.fillRect(x + (c + 1) * scale, y + r * scale, scale, scale);
      }
    }
  }

  text(str, x, y, ink = 3, scale = 1) {
    for (const ch of str) {
      this.glyph(ch, x, y, ink, scale);
      x += T * scale;
    }
  }

  center(str, y, ink = 3, scale = 1, x0 = 0, width = W) {
    this.text(str, x0 + (width - str.length * T * scale) / 2, y, ink, scale);
  }

  box(col, row, w, h) {
    const x = col * T + 3, y = row * T + 3, bw = w * T - 6, bh = h * T - 6;
    this.rect(x + 1, y, bw - 2, 1);
    this.rect(x + 1, y + bh - 1, bw - 2, 1);
    this.rect(x, y + 1, 1, bh - 2);
    this.rect(x + bw - 1, y + 1, 1, bh - 2);
  }
}

// ---------------------------------------------------------------- input

const KEYMAP = {
  ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
  KeyX: "a", Space: "a", KeyZ: "b",
  Enter: "start", ShiftLeft: "select", ShiftRight: "select", Backspace: "select",
};

class Input {
  #held = new Set();
  #queued = new Set();
  #edge = new Set();

  constructor(onGesture) {
    addEventListener("keydown", e => {
      const button = KEYMAP[e.code];
      if (!button || e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      onGesture();
      if (!e.repeat) {
        this.#held.add(button);
        this.#queued.add(button);
      }
    });
    addEventListener("keyup", e => {
      const button = KEYMAP[e.code];
      if (!button) return;
      e.preventDefault();
      this.#held.delete(button);
    });
    addEventListener("blur", () => this.#held.clear());
  }

  poll() {
    [this.#edge, this.#queued] = [this.#queued, this.#edge];
    this.#queued.clear();
  }

  held(button) {
    return this.#held.has(button);
  }

  pressed(button) {
    return this.#edge.has(button);
  }
}

// ---------------------------------------------------------------- audio

const SFX = {
  move: [[196, 0.02]],
  rotate: [[440, 0.03], [587, 0.03]],
  lock: [[110, 0.07]],
  clear: [[523, 0.06], [659, 0.06], [784, 0.06], [1047, 0.1]],
  tetris: [[523, 0.05], [659, 0.05], [784, 0.05], [1047, 0.05], [784, 0.05], [1047, 0.05], [1319, 0.2]],
  levelup: [[784, 0.08], [988, 0.08], [1175, 0.08], [1568, 0.16]],
  gameover: [[392, 0.15], [349, 0.15], [330, 0.15], [262, 0.4]],
  pause: [[659, 0.06], [0, 0.03], [659, 0.06]],
  select: [[880, 0.04]],
  start: [[523, 0.05], [784, 0.1]],
};

class Sound {
  #ctx = null;
  #out = null;

  get ready() {
    return this.#ctx !== null;
  }

  get now() {
    return this.#ctx.currentTime;
  }

  unlock() {
    if (!this.#ctx) {
      this.#ctx = new AudioContext();
      this.#out = this.#ctx.createGain();
      this.#out.gain.value = 0.5;
      this.#out.connect(this.#ctx.destination);
    }
    if (this.#ctx.state === "suspended") this.#ctx.resume();
  }

  tone(freq, start, dur, vol = 0.06) {
    const osc = this.#ctx.createOscillator();
    const gain = this.#ctx.createGain();
    osc.type = "square";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, start);
    gain.gain.setValueAtTime(vol, start + dur * 0.8);
    gain.gain.linearRampToValueAtTime(0, start + dur);
    osc.connect(gain).connect(this.#out);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  }

  sfx(name) {
    if (!this.ready) return;
    let t = this.now;
    for (const [freq, dur] of SFX[name]) {
      if (freq) this.tone(freq, t, dur, 0.07);
      t += dur;
    }
  }
}

// ---------------------------------------------------------------- scenes

// Left border x of each cell column, and the y of each cell row, on the level-select screen.
const LEVEL_BORDERS = [35, 52, 68, 84, 100];
const LEVEL_ROW_Y = [47, 63];

class TitleScene {
  update(app) {
    if (app.input.pressed("start")) {
      app.sound.sfx("start");
      app.go(new LevelScene());
    }
  }

  draw(s) {
    s.tilePx(TITLE_SCREEN, 0, 0);
  }
}

class LevelScene {
  #t = 0;

  update(app) {
    const { input, options, sound } = app;
    this.#t++;

    const dx = (input.pressed("right") ? 1 : 0) - (input.pressed("left") ? 1 : 0);
    if (dx) {
      options.level = Math.min(9, Math.max(0, options.level + dx));
      sound.sfx("select");
    }
    if (input.pressed("down") && options.level < 5) {
      options.level += 5;
      sound.sfx("select");
    }
    if (input.pressed("up") && options.level >= 5) {
      options.level -= 5;
      sound.sfx("select");
    }

    if (input.pressed("start") || input.pressed("a")) {
      const bonus = input.pressed("start") && input.held("a") ? 10 : 0;
      sound.sfx("start");
      app.go(new PlayScene(app, options.level + bonus));
    } else if (input.pressed("b")) {
      app.go(new TitleScene());
    }
  }

  draw(s, app) {
    s.tilePx(LEVEL_SCREEN, 0, 0);

    // Two rows of five cells; the selected digit blinks.
    const blink = this.#t % 32 < 16;
    for (let d = 0; d < 10; d++) {
      const x = LEVEL_BORDERS[d % 5] + 2;
      const y = LEVEL_ROW_Y[Math.floor(d / 5)];
      const selected = d === app.options.level && !blink;
      s.tilePx((selected ? LEVEL_DIGITS_SELECTED : LEVEL_DIGITS_PLAIN)[d], x, y);
    }
  }
}

const PAUSABLE = new Set(["entry", "fall", "clear", "shift"]);
const CURTAIN_HOLD = 70, CURTAIN_TOTAL = CURTAIN_HOLD + FIELD_ROWS;
const COLLAPSE_AT = FLASH_START + 6 * FLASH_STEP + 13;

class PlayScene {
  #field;
  #cur = null;
  #next = 0;
  #hidden = 0;
  #state = "entry";
  #timer = ENTRY_FRAMES;
  #paused = false;
  #hideNext = false;
  #gravCount = 0;
  #softTimer = 0;
  #soft = 0;
  #downLocked = false;
  #stuck = 0;
  #das = 0;
  #dasDir = 0;
  #clearRows = [];
  #score = 0;
  #lines = 0;
  #level;

  constructor(app, level) {
    this.app = app;
    this.#level = level;
    this.#field = Array.from({ length: FIELD_ROWS }, () => new Uint8Array(FIELD_COLS));
    // The ROM primes a three-piece pipeline (active, next, hidden) before the first spawn.
    this.#advance();
    this.#advance();
  }

  // Mirrors the ROM: reroll up to twice when the hidden and new pieces are bit-subsets of the active one.
  #advance() {
    const current = this.#next;
    const draw = () => Math.floor(Math.random() * 7);
    let fresh = draw();
    for (let n = 0; n < 2 && (this.#hidden | fresh | current) === current; n++) fresh = draw();
    this.#next = this.#hidden;
    this.#hidden = fresh;
    return current;
  }

  #gravity() {
    return GRAVITY[Math.min(this.#level, MAX_LEVEL)];
  }

  #hit(rot, x, y) {
    for (const [cx, cy] of this.#cur.piece.states[rot]) {
      const fx = x + cx, fy = y + cy;
      if (fx < 0 || fx >= FIELD_COLS || fy >= FIELD_ROWS) return true;
      if (fy >= 0 && this.#field[fy][fx]) return true;
    }
    return false;
  }

  #spawn() {
    this.#cur = { piece: PIECES[this.#advance()], rot: 0, x: SPAWN_X, y: SPAWN_Y };
    this.#gravCount = this.#gravity();
    this.#soft = 0;
    this.#state = "fall";
  }

  #shift(dir) {
    const p = this.#cur;
    if (this.#hit(p.rot, p.x + dir, p.y)) return false;
    p.x += dir;
    this.app.sound.sfx("move");
    return true;
  }

  // No wall kicks: a blocked rotation is simply dropped.
  #rotate(dir) {
    const p = this.#cur;
    const rot = (p.rot + dir + 4) % 4;
    if (this.#hit(rot, p.x, p.y)) return;
    p.rot = rot;
    this.app.sound.sfx("rotate");
  }

  #stepDown(soft) {
    const p = this.#cur;
    if (!this.#hit(p.rot, p.x, p.y + 1)) {
      p.y++;
      if (soft) this.#soft++;
      return;
    }
    // Blocked at the spawn spot: the first time it locks, the second time it ends the game.
    const atSpawn = p.x === SPAWN_X && p.y === SPAWN_Y;
    if (atSpawn && this.#stuck === 1) {
      this.#gameOver();
      return;
    }
    this.#stuck = atSpawn ? 1 : 0;
    this.#lock();
  }

  #gameOver() {
    this.#cur = null;
    this.#state = "curtain";
    this.#timer = 0;
    this.app.sound.sfx("gameover");
  }

  #lock() {
    const { piece, rot, x, y } = this.#cur;
    piece.states[rot].forEach(([cx, cy], i) => {
      if (y + cy >= 0) this.#field[y + cy][x + cx] = cellTile(piece, rot, i) + 1;
    });
    this.#cur = null;
    this.#downLocked = true;
    this.#score = Math.min(999999, this.#score + this.#soft);

    this.#clearRows = this.#field.flatMap((row, i) => (row.every(Boolean) ? [i] : []));
    this.app.sound.sfx(this.#clearRows.length === 4 ? "tetris" : this.#clearRows.length ? "clear" : "lock");
    this.#state = this.#clearRows.length ? "clear" : "entry";
    this.#timer = this.#clearRows.length ? 0 : ENTRY_FRAMES;
  }

  #collapse() {
    const n = this.#clearRows.length;
    const kept = this.#field.filter((_, i) => !this.#clearRows.includes(i));
    while (kept.length < FIELD_ROWS) kept.unshift(new Uint8Array(FIELD_COLS));
    this.#field = kept;
    this.#clearRows = [];

    this.#score = Math.min(999999, this.#score + LINE_SCORE[n] * (this.#level + 1));
    this.#lines += n;
    // A-type: the level rises once lines / 10 passes it (so a level-5 start needs 60 lines).
    if (this.#level < MAX_LEVEL && Math.floor(this.#lines / 10) > this.#level) {
      this.#level++;
      this.app.sound.sfx("levelup");
    }
    this.#state = "shift";
    this.#timer = SHIFT_FRAMES;
  }

  #fall(input) {
    // B is checked first and turns the piece the opposite way to A.
    if (input.pressed("b")) this.#rotate(1);
    else if (input.pressed("a")) this.#rotate(-1);

    const dir = (input.held("right") ? 1 : 0) - (input.held("left") ? 1 : 0);
    if (dir === 0) {
      this.#das = 0;
    } else if (dir !== this.#dasDir || input.pressed("left") || input.pressed("right")) {
      this.#shift(dir);
      this.#das = 0;
    } else if (++this.#das >= DAS_DELAY) {
      this.#das = this.#shift(dir) ? DAS_DELAY - DAS_REPEAT : DAS_DELAY - 1;
    }
    this.#dasDir = dir;

    // Soft drop only works with Down alone, and needs a fresh press after each lock.
    const downOnly = input.held("down") && !input.held("left") && !input.held("right");
    if (downOnly && this.#downLocked && input.pressed("down") && !input.pressed("left") && !input.pressed("right")) {
      this.#downLocked = false;
    }
    if (downOnly && !this.#downLocked) {
      if (this.#softTimer === 0) {
        this.#softTimer = SOFT_DROP_FRAMES;
        this.#stepDown(true);
      }
      return;
    }

    this.#soft = 0;
    if (this.#gravCount > 0) {
      this.#gravCount--;
    } else {
      this.#gravCount = this.#gravity();
      this.#stepDown(false);
    }
  }

  update(app) {
    const { input, sound } = app;

    if (PAUSABLE.has(this.#state) && input.pressed("start")) {
      this.#paused = !this.#paused;
      sound.sfx("pause");
      return;
    }
    if (this.#paused) return;
    if (input.pressed("select") && PAUSABLE.has(this.#state)) this.#hideNext = !this.#hideNext;

    switch (this.#state) {
      case "entry":
        if (--this.#timer <= 0) this.#spawn();
        break;
      case "fall":
        this.#fall(input);
        break;
      case "clear":
        if (++this.#timer >= COLLAPSE_AT) this.#collapse();
        break;
      case "shift":
        if (--this.#timer > 0) break;
        this.#state = "entry";
        this.#timer = 1;
        break;
      case "curtain":
        if (++this.#timer >= CURTAIN_TOTAL) this.#state = "over";
        break;
      case "over":
        if (input.pressed("start") || input.pressed("a")) app.go(new LevelScene());
        break;
    }

    if (this.#softTimer > 0) this.#softTimer--;
  }

  draw(s) {
    s.tilePx(FRAME_SCREEN, 0, 0);
    this.#drawPanel(s);

    if (this.#paused) {
      s.center("PAUSE", 64, 3, 1, FIELD_X, FIELD_COLS * T);
      return;
    }

    this.#drawField(s);

    if (this.#cur) {
      const { piece, rot, x, y } = this.#cur;
      piece.states[rot].forEach(([cx, cy], i) => {
        if (y + cy >= 0) s.tile(BLOCKS[cellTile(piece, rot, i)], FIELD_COL0 + x + cx, y + cy);
      });
    }

    if (this.#state === "over") {
      s.rect(FIELD_X + 24, 24, 64, 48, 0);
      s.box(FIELD_COL0 + 3, 3, 8, 6);
      s.center("GAME", 38, 3, 1, FIELD_X, FIELD_COLS * T);
      s.center("OVER", 50, 3, 1, FIELD_X, FIELD_COLS * T);
      s.rect(FIELD_X + 24, 80, 64, 48, 0);
      s.box(FIELD_COL0 + 3, 10, 8, 6);
      ["PLEASE", "TRY", "AGAIN"].forEach((word, i) => s.center(word, 90 + i * 12, 3, 1, FIELD_X, FIELD_COLS * T));
    }
  }

  #drawField(s) {
    const t = this.#timer;
    const covering = this.#state === "curtain";
    // Game over: solid blocks rise one row per frame, hold, then clear the same way.
    const curtained = r => covering && (t < CURTAIN_HOLD ? r >= FIELD_ROWS - t : r < FIELD_ROWS - (t - CURTAIN_HOLD));
    // Line clear: flash, original, flash, original, flash, original, then blank.
    const phase = this.#state === "clear" && t >= FLASH_START ? Math.floor((t - FLASH_START) / FLASH_STEP) : -1;

    this.#field.forEach((row, r) => {
      if (curtained(r)) {
        for (let c = 0; c < FIELD_COLS; c++) s.tile(CURTAIN, FIELD_COL0 + c, r);
        return;
      }
      if (this.#state === "over" || (covering && t >= CURTAIN_HOLD)) return;
      const flashing = phase >= 0 && this.#clearRows.includes(r);
      if (flashing && phase >= 6) return;
      row.forEach((v, c) => {
        if (!v) return;
        s.tile(flashing && phase % 2 === 0 ? FLASH : BLOCKS[v - 1], FIELD_COL0 + c, r);
      });
    });
  }

  #drawPanel(s) {
    // Values are right-aligned to a tile column inside the panel boxes, with no zero padding.
    const value = (n, col, row) => {
      [...String(n)].reverse().forEach((d, i) => s.tile(DIGITS[+d], col - i, row));
    };

    value(this.#score, 18, 3);
    value(this.#level, 17, 7);
    value(this.#lines, 17, 10);

    if (this.#hideNext) return;
    for (const { tile, x, y } of NEXT_PREVIEW[this.#next]) s.tilePx(tile, x, y);
  }
}

// ---------------------------------------------------------------- app

class App {
  screen = new Screen(document.querySelector("#screen"));
  sound = new Sound();
  input = new Input(() => this.sound.unlock());
  options = { level: 0 };
  scene = new TitleScene();

  go(scene) {
    this.scene = scene;
  }

  run() {
    let last = performance.now();
    let acc = 0;
    let stale = true;
    const loop = now => {
      acc += Math.min(now - last, 250);
      last = now;
      while (acc >= FRAME_MS) {
        acc -= FRAME_MS;
        this.input.poll();
        this.scene.update(this);
        stale = true;
      }
      // Scenes only change when the game steps, so skip repainting on refreshes between steps.
      if (stale) {
        this.scene.draw(this.screen, this);
        stale = false;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}

new App().run();
