import { vi } from "vitest";

// A minimal stand-in for the App the scenes talk to: scripted buttons, recorded sounds and scene changes.
export function makeApp() {
  const pressed = new Set();
  const held = new Set();
  const sfx = [];
  const app = {
    input: { pressed: b => pressed.has(b), held: b => held.has(b) },
    sound: { sfx: name => sfx.push(name) },
    options: { level: 0 },
    scene: null,
    go: vi.fn(scene => {
      app.scene = scene;
    }),
  };
  return { app, pressed, held, sfx };
}

// Runs one frame with `buttons` freshly pressed.
export function frame(scene, ctx, buttons = []) {
  ctx.pressed.clear();
  for (const b of buttons) ctx.pressed.add(b);
  scene.update(ctx.app);
  ctx.pressed.clear();
}

export function frames(scene, ctx, n) {
  for (let i = 0; i < n; i++) frame(scene, ctx);
}

export const fills = (context, color) =>
  context.calls.filter(c => c[0] === "fillRect" && c[1] === color).map(c => c.slice(2));
