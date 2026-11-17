// Canvas, audio and stylesheet stand-ins so the game's modules can load and be inspected in jsdom.

export class FakeContext {
  constructor(canvas) {
    this.canvas = canvas;
    this.calls = [];
    this.fillStyle = "";
    this.imageSmoothingEnabled = true;
  }

  fillRect(...args) {
    this.calls.push(["fillRect", this.fillStyle, ...args]);
  }

  drawImage(...args) {
    this.calls.push(["drawImage", ...args]);
  }
}

class FakeOffscreenCanvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.context = new FakeContext(this);
  }

  getContext() {
    return this.context;
  }
}

globalThis.OffscreenCanvas = FakeOffscreenCanvas;
HTMLCanvasElement.prototype.getContext = function getContext() {
  this.context ??= new FakeContext(this);
  return this.context;
};

export const COLORS = ["#d7e894", "#aec440", "#527f39", "#204631"];

const style = document.createElement("style");
style.textContent = `:root { ${COLORS.map((c, i) => `--gb-${i}: ${c};`).join(" ")} }`;
document.head.append(style);
