import { describe, it, expect } from "vitest";
import { generateSessionCode, isValidSessionCode, WORDS } from "./sessionCode";

describe("generateSessionCode", () => {
  it("returns three hyphen-joined lowercase words", () => {
    const code = generateSessionCode();
    expect(code.split("-")).toHaveLength(3);
    expect(isValidSessionCode(code)).toBe(true);
  });

  it("only uses words from the wordlist", () => {
    const code = generateSessionCode();
    for (const part of code.split("-")) {
      expect(WORDS as readonly string[]).toContain(part);
    }
  });

  it("is deterministic for a fixed random source", () => {
    expect(generateSessionCode(() => 0)).toBe(generateSessionCode(() => 0));
  });

  it("produces unique codes in practice", () => {
    const codes = new Set(
      Array.from({ length: 200 }, () => generateSessionCode()),
    );
    expect(codes.size).toBe(200);
  });
});

describe("isValidSessionCode", () => {
  it("accepts three lowercase hyphenated words", () => {
    expect(isValidSessionCode("amber-bear-cactus")).toBe(true);
  });

  it("rejects empty, spaced, uppercase, and wrong-length codes", () => {
    expect(isValidSessionCode("")).toBe(false);
    expect(isValidSessionCode("amber bear cactus")).toBe(false);
    expect(isValidSessionCode("Amber-Bear-Cactus")).toBe(false);
    expect(isValidSessionCode("amber-bear")).toBe(false);
    expect(isValidSessionCode("amber-bear-cactus-dove")).toBe(false);
  });
});
