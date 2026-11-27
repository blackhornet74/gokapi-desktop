import { describe, expect, it } from "vitest";
import { suggestArchiveName } from "./archive";

const date = new Date(2026, 10, 27, 18, 5);

describe("suggestArchiveName", () => {
  it("uses the common parent folder name", () => {
    expect(
      suggestArchiveName(
        ["C:\\Users\\alessio\\Documents\\alpha.txt", "C:\\Users\\alessio\\Documents\\beta.txt"],
        date,
      ),
    ).toBe("Documents-20261127-1805.zip");
    expect(suggestArchiveName(["/home/user/report/a.pdf", "/home/user/report/b.pdf"], date)).toBe(
      "report-20261127-1805.zip",
    );
  });

  it("falls back when files come from different folders", () => {
    expect(suggestArchiveName(["C:\\one\\a.txt", "C:\\two\\b.txt"], date)).toBe(
      "gokapi-20261127-1805.zip",
    );
  });

  it("falls back for drive roots and empty parents", () => {
    expect(suggestArchiveName(["C:\\a.txt", "C:\\b.txt"], date)).toBe(
      "gokapi-20261127-1805.zip",
    );
  });
});
