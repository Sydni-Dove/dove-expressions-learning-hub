import { describe, it, expect } from "vitest";
import { escapePipe, parseRow, parseRows, serializeRow } from "@/lib/pipe-lines";

describe("pipe line format — nothing the author types is dropped", () => {
  it("splits plain rows", () => {
    expect(parseRow("Heading | Body", 2)).toEqual(["Heading", "Body"]);
  });
  it("the last field absorbs extra unescaped pipes (no truncation)", () => {
    expect(parseRow("Heading | one | two | three", 2)).toEqual(["Heading", "one | two | three"]);
    expect(parseRow("John 3:16 | For God so loved | the world", 2)).toEqual(["John 3:16", "For God so loved | the world"]);
  });
  it("three-field rows: extra pipes land in the note", () => {
    expect(parseRow("Ref | Text | Note | more", 3)).toEqual(["Ref", "Text", "Note | more"]);
  });
  it("an escaped pipe stays inside its field, even a middle one", () => {
    expect(parseRow("Ref | Text with a \\| pipe | Note", 3)).toEqual(["Ref", "Text with a | pipe", "Note"]);
  });
  it("empty middle fields are preserved", () => {
    expect(parseRow("Ref |  | Note", 3)).toEqual(["Ref", "", "Note"]);
  });
  it("round-trips: serialize → parse returns the same fields, including pipes", () => {
    const rows: string[][] = [
      ["Heading", "Body with | a pipe"],
      ["A | B", "C"],
      ["Only heading", ""]
    ];
    // (a trailing empty field is simply omitted when written; readers treat a missing field as "")
    const pad = (r: string[], n: number) => [...r, ...Array(Math.max(0, n - r.length)).fill("")];
    for (const r of rows) expect(pad(parseRow(serializeRow(r), 2), 2)).toEqual(r);
    const three = ["Ref", "Text | with pipe", "Note | too"];
    expect(parseRow(serializeRow(three), 3)).toEqual(three);
    const gap = ["Ref", "", "Note"];
    expect(parseRow(serializeRow(gap), 3)).toEqual(gap);
  });
  it("serialize escapes pipes and drops only trailing empties", () => {
    expect(escapePipe("a|b")).toBe("a\\|b");
    expect(serializeRow(["a", "b", ""])).toBe("a | b");
    expect(serializeRow(["a", "", "c"])).toBe("a |  | c");
  });
  it("parseRows skips blank lines", () => {
    expect(parseRows("a | b\n\n  \nc | d", 2)).toEqual([["a", "b"], ["c", "d"]]);
  });
});
