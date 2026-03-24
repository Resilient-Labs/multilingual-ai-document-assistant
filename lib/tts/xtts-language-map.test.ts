import { describe, expect, it } from "vitest";
import { mapToXttsLanguage } from "@/lib/tts/xtts-language-map";

describe("mapToXttsLanguage", () => {
  it("rejects unsupported XTTS languages", () => {
    expect(() => mapToXttsLanguage("sv")).toThrow(
      "No XTTS language mapping available for: sv"
    );
    expect(() => mapToXttsLanguage("vi")).toThrow(
      "No XTTS language mapping available for: vi"
    );
  });

  it("keeps existing mappings stable", () => {
    expect(mapToXttsLanguage("zh")).toBe("zh");
    expect(mapToXttsLanguage("tr")).toBe("tr");
  });
});
