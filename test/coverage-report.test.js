import { describe, expect, it } from "vitest";
import { buildReport } from "../scripts/coverage-report.js";

const metric = pct => ({ total: 10, covered: Math.round(pct / 10), skipped: 0, pct });
const entry = (s, b, f, l) => ({ statements: metric(s), branches: metric(b), functions: metric(f), lines: metric(l) });

const summary = {
  total: entry(96.5, 90, 100, 97),
  "/repo/rom/tetris.js": entry(95, 88.25, 100, 96),
  "/repo/rom/art.js": entry(100, 100, 100, 100),
};
const results = { numTotalTests: 121, numPassedTests: 120, numFailedTests: 1 };

const report = (overrides = {}) => buildReport({ summary, results, threshold: 80, root: "/repo", ...overrides });

describe("buildReport", () => {
  it("starts with a title", () => {
    expect(report().startsWith("# Test coverage\n")).toBe(true);
  });

  it("summarises the test run", () => {
    const text = report();
    expect(text).toMatch(/\| Tests \| Passed \| Failed \|/);
    expect(text).toMatch(/\| 121 \| 120 \| 1 \|/);
  });

  it("lists every file with its four metrics, paths relative to the repo", () => {
    const text = report();
    expect(text).toMatch(/\| File \| Statements \| Branches \| Functions \| Lines \|/);
    expect(text).toContain("| `rom/tetris.js` | 95% | 88.25% | 100% | 96% |");
    expect(text).toContain("| `rom/art.js` | 100% | 100% | 100% | 100% |");
    expect(text).not.toContain("/repo/");
  });

  it("sorts files by name and puts the total last", () => {
    const rows = report().split("\n").filter(line => line.startsWith("| `rom/") || line.startsWith("| **Total**"));
    expect(rows.map(r => r.split("|")[1].trim())).toEqual(["`rom/art.js`", "`rom/tetris.js`", "**Total**"]);
    expect(rows.at(-1)).toBe("| **Total** | **96.5%** | **90%** | **100%** | **97%** |");
  });

  it("says the threshold is met when every total is at or above it", () => {
    expect(report()).toContain("Threshold: 80% on every metric — ✅ met");
  });

  it("says the threshold is missed when any total is below it", () => {
    const low = { ...summary, total: entry(96.5, 79.99, 100, 97) };
    expect(report({ summary: low })).toContain("Threshold: 80% on every metric — ❌ not met");
  });

  it("flags a failing test run", () => {
    expect(report()).toContain("❌");
    const clean = report({ results: { numTotalTests: 5, numPassedTests: 5, numFailedTests: 0 } });
    expect(clean).toMatch(/\| 5 \| 5 \| 0 \|/);
  });

  it("ends with a single newline and carries no timestamp, so unchanged results give an unchanged file", () => {
    const text = report();
    expect(text.endsWith("\n")).toBe(true);
    expect(text.endsWith("\n\n")).toBe(false);
    expect(report()).toBe(text);
  });
});
