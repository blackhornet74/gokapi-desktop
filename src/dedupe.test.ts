import { describe, expect, it } from "vitest";
import { filterActivePaths, isRecentDuplicate } from "./dedupe";

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
