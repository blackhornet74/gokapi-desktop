import { describe, expect, it } from "vitest";
import { expiryState } from "./expiry";

const now = Date.UTC(2026, 10, 28, 12, 0, 0);

describe("expiryState", () => {
  it("recognises missing or unlimited expiry", () => {
    expect(expiryState(null, now)).toBe("none");
    expect(expiryState(undefined, now)).toBe("none");
    expect(expiryState("", now)).toBe("none");
  });

  it("classifies normal, soon and expired dates", () => {
    expect(expiryState(new Date(now + 3 * 86400000).toISOString(), now)).toBe("normal");
    expect(expiryState(new Date(now + 6 * 3600000).toISOString(), now)).toBe("soon");
    expect(expiryState(new Date(now - 1).toISOString(), now)).toBe("expired");
  });
});
