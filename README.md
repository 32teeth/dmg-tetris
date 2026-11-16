# Tetris — Game Boy

A faithful browser recreation of the original 1989 Game Boy _Tetris_ (A-type), drawn on a 160×144 canvas with the DMG's four-shade palette and a simulated LCD pixel grid. No dependencies, no build step.

The game lives in [`rom/`](./rom).

## Play

**[Play it in your browser](https://32teeth.github.io/tetris)**

GitHub Pages serves the repository root from the `main` branch (Settings → Pages → Source: *Deploy from a branch*, `main` / `/ (root)`). The root [`index.html`](./index.html) loads the game from `rom/` via `<base href="rom/">`, so the site opens straight into the game; keep it in sync with [`rom/index.html`](./rom/index.html).

To run it locally, open [`rom/index.html`](./rom/index.html) in a modern browser, or serve the folder:

```sh
npx serve rom
# or
python3 -m http.server --directory rom 8000
```

## Controls

| Button                   | Key                   |
| ------------------------ | --------------------- |
| D-Pad                    | Arrow keys            |
| A (rotate ↻)             | `X` / `Space`         |
| B (rotate ↺)             | `Z`                   |
| Start                    | `Enter`               |
| Select (hide NEXT piece) | `Shift` / `Backspace` |

- **Title:** `Enter` to continue.
- **Level select:** arrows pick a level (0–9). `Enter` or `X` starts; hold `X` while pressing `Enter` to start at level +10. `Z` goes back.
- **In game:** `Down` soft-drops (press again after each lock), `Enter` pauses.

## What's faithful to the original

- Piece orientations, spawn position and the "no wall kicks" rotation rule.
- Gravity per level, auto-shift (DAS) timing, soft-drop speed, line-clear flash and game-over curtain, all counted in 59.73 Hz frames.
- The ROM's three-piece pipeline and its reroll rule for picking the next piece.
- Scoring: 40 / 100 / 300 / 1200 × (level + 1), plus soft-drop cells; the level rises every 10 lines.
- All art — blocks, walls, panel, digits, title and level-select screens — is stored as pixel data using the original four shades.

There is no music, and no B-type or 2-player mode.

## Project layout

| File                                 | Purpose                                         |
| ------------------------------------ | ----------------------------------------------- |
| [`rom/index.html`](./rom/index.html) | Page shell and key legend                       |
| [`rom/tetris.css`](./rom/tetris.css) | Palette, scaling and the LCD pixel-grid overlay |
| [`rom/tetris.js`](./rom/tetris.js)   | Game logic, input, sound effects and rendering  |
| [`rom/art.js`](./rom/art.js)         | 8×8 tile art (blocks, digits, panel frame)      |
| [`rom/screens.js`](./rom/screens.js) | Full-screen pixel art (title, level select)     |

Pixel art is written as rows of shade digits (`0` lightest … `3` darkest) and baked into offscreen canvases at startup.

### Tweaking the LCD look

In `rom/tetris.css`:

| Variable            | Effect                                                                 |
| ------------------- | ---------------------------------------------------------------------- |
| `--scale`           | Screen pixels per game pixel (3 or more keeps the grid lines readable) |
| `--grid`            | Color and opacity of the pixel-grid lines and inner shadow             |
| `--gap`             | Thickness of the grid lines                                            |
| `--gb-0` … `--gb-3` | The four LCD shades, lightest to darkest                               |

## Contributing

Bug reports and feature requests are welcome — please use the [issue templates](./.github/ISSUE_TEMPLATE). Participation is governed by the [Code of Conduct](./CODE_OF_CONDUCT.md).

## License

[Creative Commons Attribution-ShareAlike 4.0 International](./LICENSE.md).

_Tetris_ is a trademark of its respective owners. This is an unofficial fan project and is not affiliated with or endorsed by them.
