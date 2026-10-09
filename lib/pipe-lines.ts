/**
 * "A | B | C" line format used by the lesson builder's list fields (takeaways,
 * key scriptures, resources, transcript, teaching-section scripture refs).
 *
 * Nothing the author types may be silently dropped, so:
 *  - a literal pipe inside a field is written as `\|` (the editor shows stored
 *    pipes escaped this way, so re-saving never changes them);
 *  - the LAST field of a row absorbs any extra unescaped pipes as plain text,
 *    so "Heading | body with | a pipe" keeps the whole body;
 *  - empty middle fields are preserved ("Ref |  | note").
 */

export function escapePipe(s: string): string {
  return s.replace(/\|/g, "\\|");
}

/** One row → one line. Trailing empty fields are dropped; pipes inside fields are escaped. */
export function serializeRow(fields: (string | undefined | null)[]): string {
  const cleaned = fields.map((f) => escapePipe(f ?? ""));
  while (cleaned.length > 1 && cleaned[cleaned.length - 1] === "") cleaned.pop();
  return cleaned.join(" | ");
}

/** Split one line into at most `maxFields` trimmed fields; the last one keeps the rest of the line. */
export function parseRow(line: string, maxFields: number): string[] {
  const fields: string[] = [];
  let cur = "";
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "\\" && line[i + 1] === "|") {
      cur += "|";
      i++;
    } else if (ch === "|" && fields.length < maxFields - 1) {
      fields.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur.trim());
  return fields;
}

/** Textarea → rows. Blank lines are skipped. */
export function parseRows(raw: string, maxFields: number): string[][] {
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => parseRow(l, maxFields));
}
