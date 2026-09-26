import { beforeEach, describe, expect, it } from "vitest";
import { clientAddress, isLockedOut, recordFailure, resetFailures } from "../src/companion-api.js";

describe("companion API failed-login throttle", () => {
  beforeEach(() => resetFailures());

  it("locks an address out after 10 failures, for the length of the window", () => {
    const start = 1_000_000;
    for (let i = 0; i < 9; i++) recordFailure("1.2.3.4", start + i);
    expect(isLockedOut("1.2.3.4", start + 100)).toBe(false);
    recordFailure("1.2.3.4", start + 200);
    expect(isLockedOut("1.2.3.4", start + 300)).toBe(true);
    expect(isLockedOut("5.6.7.8", start + 300)).toBe(false);
    // Ten minutes later the failures have aged out.
    expect(isLockedOut("1.2.3.4", start + 10 * 60_000 + 500)).toBe(false);
  });

  it("uses the first x-forwarded-for address when a proxy is in front", () => {
    const request = (headers: Record<string, string>, remote = "127.0.0.1") => ({ headers, socket: { remoteAddress: remote } }) as never;
    expect(clientAddress(request({ "x-forwarded-for": "9.9.9.9, 127.0.0.1" }))).toBe("9.9.9.9");
    expect(clientAddress(request({}))).toBe("127.0.0.1");
  });
});
