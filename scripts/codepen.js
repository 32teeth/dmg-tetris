// Bundles the game into the three panes CodePen offers (HTML, CSS, JS).
//
//   npm run codepen   ->  codepen/index.html, codepen/style.css, codepen/script.js

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Turns an ES module into plain script text so several can be concatenated into one file.
export function toScript(source) {
  return source
    .replace(/^import .*\n/gm, "")
    .replace(/\n*^export \{[^}]*\};?\n?/gm, "\n")
    .replace(/^export (?=(?:async )?(?:const|let|function|class) )/gm, "");
}

const read = path => readFileSync(new URL(`../rom/${path}`, import.meta.url), "utf8");

export function build() {
  const page = read("index.html");
  const cdn = page.match(/"multi-key-handler":\s*"([^"]+)"/)[1];

  const svg = read("pocket.svg")
    .replace(/<\?xml[^>]*>\s*/, "")
    .replace(/<svg [^>]*>/, '<svg class="art" viewBox="36 19 466 760" aria-hidden="true">');
  const body = page
    .match(/<body>([\s\S]*)<\/body>/)[1]
    .replace(/<img class="art"[^>]*>/, svg)
    .replace(/^\n+|\s+$/g, "");

  const script = ["art.js", "screens.js", "tetris.js", "handheld.js"]
    .map(file => toScript(read(file)))
    .join("\n")
    .replace('import("multi-key-handler")', `import("${cdn}")`);

  return {
    "index.html": `${body}\n`,
    "style.css": `${read("tetris.css")}\n${read("handheld.css")}`,
    "script.js": `${script}\nnew App(document.querySelector("#screen")).run();\ninitHandheld();\n`,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = new URL("../codepen/", import.meta.url);
  mkdirSync(out, { recursive: true });
  for (const [name, text] of Object.entries(build())) {
    writeFileSync(new URL(name, out), text);
    console.log(`codepen/${name}  ${(text.length / 1024).toFixed(1)} KB`);
  }
}
