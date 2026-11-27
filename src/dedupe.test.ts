import { describe, expect, it } from "vitest";
import { filterActivePaths, isRecentDuplicate, pruneSelection, toggleSelection } from "./dedupe";

describe("isRecentDuplicate", () => {
  it("ignores the same drop within the window", () => {
    const previous = { key: "C:\\file.rar", at: 1000 };
    expect(isRecentDuplicate(previous, "C:\\file.rar", 1500)).toBe(true);
    expect(isRecentDuplicate(previous, "C:\\file.rar", 2500)).toBe(false);
    expect(isRecentDuplicate(previous, "C:\\other.rar", 1500)).toBe(false);
    expect(isRecentDuplicate(null, "C:\\file.rar", 1500)).toBe(false);
  });
});

describe("filterActivePaths", () => {
  it("drops paths already queued or uploading", () => {
    const queue = [
      { path: "a", status: "queued" },
      { path: "b", status: "uploading" },
      { path: "c", status: "done" },
    ];
    expect(filterActivePaths(queue, ["a", "b", "c", "d"])).toEqual(["c", "d"]);
  });
});

describe("selection helpers", () => {
  it("toggles ids without mutating the original set", () => {
    const original = new Set(["a"]);
    const added = toggleSelection(original, "b");
    expect([...added]).toEqual(["a", "b"]);
    expect([...original]).toEqual(["a"]);
    expect([...toggleSelection(added, "a")]).toEqual(["b"]);
  });

  it("drops ids that no longer exist", () => {
    expect([...pruneSelection(new Set(["a", "b", "c"]), ["b", "c"])]).toEqual(["b", "c"]);
  });
});
