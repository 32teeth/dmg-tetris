# Tetris — Game Boy

A faithful browser recreation of the original 1989 Game Boy _Tetris_ (A-type), drawn on a 160×144 canvas with the DMG's four-shade palette and a simulated LCD pixel grid, played on a Game Boy Pocket you can drive with a keyboard, mouse or touch screen. No build step.

The game lives in [`rom/`](./rom).

## Play

**[Play it in your browser](https://32teeth.github.io/dmg-tetris)**

GitHub Pages serves the repository root from the `main` branch (Settings → Pages → Source: _Deploy from a branch_, `main` / `/ (root)`). The root [`index.html`](./index.html) loads the game from `rom/` via `<base href="rom/">`, so the site opens straight into the game; keep it in sync with [`rom/index.html`](./rom/index.html).

The on-screen D-pad and buttons turn presses into real keyboard events, and [`multi-key-handler`](https://www.npmjs.com/package/multi-key-handler) (loaded from jsDelivr, pinned in the import map in `index.html`) lights up the matching button for both on-screen and physical key presses. If the package can't be loaded the game still plays; the buttons just don't light up.

The page uses an ES module, so serve it over HTTP to run it locally (opening the file directly won't load the on-screen controls):

```sh
npx serve rom
# or
python3 -m http.server --directory rom 8000
```

## Controls

| Button                   | Key                         |
| ------------------------ | --------------------------- |
| D-Pad                    | Arrow keys                  |
| A (rotate ↻)             | `X`                         |
| B (rotate ↺)             | `Z`                         |
| Start                    | `Enter`                     |
| Select (hide NEXT piece) | `Space` / `Shift` / `Backspace` |

On a touch screen, use the on-screen buttons; the D-pad can be slid across for diagonals, and several buttons can be held at once. The console is sized to fit the screen, text selection and zoom gestures are disabled, and the game is portrait-only: in landscape on a phone it is frozen behind a "rotate your device" prompt. The key legend below the console only appears on desktop.

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
| [`rom/index.html`](./rom/index.html) | Page shell, on-screen controls and key legend   |
| [`rom/pocket.svg`](./rom/pocket.svg) | Game Boy Pocket body artwork                    |
| [`rom/handheld.css`](./rom/handheld.css) | Pocket layout, buttons and touch styling    |
| [`rom/handheld.js`](./rom/handheld.js) | Touch/mouse input and button lighting         |
| [`rom/manifest.webmanifest`](./rom/manifest.webmanifest) | Home-screen app metadata (portrait) |
| [`rom/tetris.css`](./rom/tetris.css) | Palette, scaling and the LCD pixel-grid overlay |
| [`rom/tetris.js`](./rom/tetris.js)   | Game logic, input, sound effects and rendering  |
| [`rom/art.js`](./rom/art.js)         | 8×8 tile art (blocks, digits, panel frame)      |
| [`rom/screens.js`](./rom/screens.js) | Full-screen pixel art (title, level select)     |

Pixel art is written as rows of shade digits (`0` lightest … `3` darkest) and baked into offscreen canvases at startup.

### Tweaking the LCD look

The palette lives in `rom/tetris.css`; the pocket's screen size follows the page size, and its grid is set in `.pocket .lcd` in `rom/handheld.css`:

| Variable            | Effect                                                                           |
| ------------------- | -------------------------------------------------------------------------------- |
| `--grid`            | Color and opacity of the pixel-grid lines and inner shadow                       |
| `--gap`             | Thickness of the grid lines, as a share of one game pixel (`handheld.css`)       |
| `--gb-0` … `--gb-3` | The four LCD shades, lightest to darkest (`tetris.css`)                          |

## Contributing

Bug reports and feature requests are welcome — please use the [issue templates](./.github/ISSUE_TEMPLATE). Participation is governed by the [Code of Conduct](./CODE_OF_CONDUCT.md).

## License

[Creative Commons Attribution-ShareAlike 4.0 International](./LICENSE.md).

_Tetris_ is a trademark of its respective owners. This is an unofficial fan project and is not affiliated with or endorsed by them.
