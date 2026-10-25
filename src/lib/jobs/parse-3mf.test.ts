import { readFileSync } from "node:fs";
import { join } from "node:path";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { parse3mf } from "./parse-3mf";

const SLICE_MESSAGE =
  "Please slice before exporting — File ▸ Export ▸ Export plate sliced file";

function zip(files: Record<string, string>): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const [path, text] of Object.entries(files)) {
    entries[path] = strToU8(text);
  }
  return zipSync(entries);
}

describe("parse3mf", () => {
  it("reads minutes, grams, and plate count from a sliced A1 3MF", () => {
    const file = readFileSync(
      join(process.cwd(), "tests/fixtures/sample-a1.3mf"),
    );
    // slice_info: 5400s + 125s, 18.4g + 0.8g. Gcode comments are different on purpose.
    const parsed = parse3mf(file);
    expect(parsed.plates).toBe(2);
    expect(parsed.minutes).toBeCloseTo(5525 / 60, 5);
    expect(parsed.grams).toBeCloseTo(19.2, 5);
  });

  it("rejects an unsliced 3MF with the slice-before-export message", () => {
    const unsliced = zip({
      "3D/3dmodel.model": "<model/>",
      "Metadata/slice_info.config": `<?xml version="1.0" encoding="UTF-8"?>
<config>
  <header>
    <header_item key="X-BBL-Client-Type" value="slicer"/>
  </header>
</config>`,
      "Metadata/plate_1.png": "not gcode",
    });
    expect(() => parse3mf(unsliced)).toThrow(SLICE_MESSAGE);
  });

  it("falls back to plate gcode comments when slice_info is missing", () => {
    const sliced = zip({
      "Metadata/plate_1.gcode": `; estimated printing time (normal mode) = 1h 0m 0s
; total filament weight [g] = 10.5
`,
      "Metadata/plate_2.gcode": `; estimated printing time (normal mode) = 30s
; total filament weight [g] = 0.5
`,
    });
    const parsed = parse3mf(sliced);
    expect(parsed.plates).toBe(2);
    expect(parsed.minutes).toBeCloseTo(60.5, 5);
    expect(parsed.grams).toBeCloseTo(11, 5);
  });

  it("uses gcode for a field the slice info does not have", () => {
    const sliced = zip({
      "Metadata/slice_info.config": `<?xml version="1.0"?>
<config>
  <plate>
    <metadata key="index" value="1"/>
    <metadata key="prediction" value="120"/>
  </plate>
</config>`,
      "Metadata/plate_1.gcode": `; estimated printing time (normal mode) = 9h 0m 0s
; total filament weight [g] = 3.25
`,
    });
    const parsed = parse3mf(sliced);
    expect(parsed.minutes).toBeCloseTo(2, 5);
    expect(parsed.grams).toBeCloseTo(3.25, 5);
    expect(parsed.plates).toBe(1);
  });
});
