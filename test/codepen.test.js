import { describe, expect, it } from "vitest";
import { build, toScript } from "../scripts/codepen.js";

describe("build", () => {
  const files = build();

  it("makes the three CodePen panes", () => {
    expect(Object.keys(files).sort()).toEqual(["index.html", "script.js", "style.css"]);
  });

  it("opts out of CodePen's loop protection", () => {
    expect(files["script.js"].startsWith("// noprotect\n")).toBe(true);
  });

  it("is a classic script: no static imports or exports, and the CDN replaces the package name", () => {
    expect(files["script.js"]).not.toMatch(/^(import|export)\b/m);
    expect(files["script.js"]).toContain('import("https://cdn.jsdelivr.net/npm/multi-key-handler@');
  });

  it("inlines the console artwork into the HTML", () => {
    expect(files["index.html"]).toContain('<svg class="art"');
    expect(files["index.html"]).not.toContain("pocket.svg");
    expect(files["index.html"]).not.toMatch(/<(script|link|html|body)\b/);
  });

  it("is plain ASCII, so CodePen's prefill and any encoding setting handle it", () => {
    for (const text of Object.values(files)) expect(text).toMatch(/^[\x00-\x7f]*$/);
  });

  it("combines both stylesheets", () => {
    expect(files["style.css"]).toContain("--gb-0");
    expect(files["style.css"]).toContain(".pocket");
  });
});

describe("toScript", () => {
  it("drops import lines", () => {
    expect(toScript('import { A } from "./a.js";\nconst b = 1;\n')).toBe("const b = 1;\n");
  });

  it("drops the export keyword from declarations", () => {
    const source = "export const A = 1;\nexport function f() {}\nexport async function g() {}\nexport class C {}\n";
    expect(toScript(source)).toBe("const A = 1;\nfunction f() {}\nasync function g() {}\nclass C {}\n");
  });

  it("drops a trailing export list, including multi-line ones", () => {
    expect(toScript("class A {}\n\nexport {\n  A,\n  B,\n};\n")).toBe("class A {}\n");
  });

  it("leaves other lines alone, including words that merely contain export", () => {
    const source = "// exports are removed\nconst exported = 1;\n";
    expect(toScript(source)).toBe(source);
  });
});
