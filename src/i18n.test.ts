import { describe, expect, it } from "vitest";
import { formatBytes, translate } from "./i18n";

describe("formatBytes", () => {
  it("formats common sizes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1024)).toBe("1.00 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.00 MB");
    expect(formatBytes(120 * 1024 * 1024)).toBe("120 MB");
  });

  it("rejects invalid values", () => {
    expect(formatBytes(-1)).toBe("—");
    expect(formatBytes(Number.NaN)).toBe("—");
  });
});

describe("translate", () => {
  it("returns localized strings with interpolation", () => {
    expect(translate("en", "days")).toBe("Expiry");
    expect(translate("it", "days")).toBe("Scadenza");
    expect(translate("en", "version", { version: "1.2.3" })).toBe("Version 1.2.3");
  });

  it("falls back to the key for missing entries", () => {
    expect(translate("en", "missing.key")).toBe("missing.key");
  });
});
