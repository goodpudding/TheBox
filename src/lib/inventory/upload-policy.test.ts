import { describe, expect, it } from "vitest";
import {
  MAX_PHOTO_BYTES,
  isServablePhotoType,
  sniffImageType,
  validatePhotoUpload,
} from "./upload-policy";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const WEBP = Buffer.concat([
  Buffer.from("RIFF"),
  Buffer.from([0x24, 0x00, 0x00, 0x00]),
  Buffer.from("WEBPVP8 "),
]);

describe("sniffImageType", () => {
  it("recognises jpeg, png and webp by their leading bytes", () => {
    expect(sniffImageType(JPEG)).toBe("image/jpeg");
    expect(sniffImageType(PNG)).toBe("image/png");
    expect(sniffImageType(WEBP)).toBe("image/webp");
  });

  it("returns null for markup and anything else", () => {
    expect(sniffImageType(Buffer.from("<html><script>1</script>"))).toBeNull();
    expect(sniffImageType(Buffer.from("<svg xmlns='x'/>"))).toBeNull();
    expect(sniffImageType(Buffer.alloc(0))).toBeNull();
  });
});

describe("validatePhotoUpload", () => {
  it("accepts a real jpeg and reports the sniffed type", () => {
    expect(validatePhotoUpload(JPEG)).toEqual({
      ok: true,
      mimeType: "image/jpeg",
    });
  });

  it("rejects html even when the browser claims it is an image", () => {
    const result = validatePhotoUpload(Buffer.from("<html></html>"));
    expect(result).toMatchObject({ ok: false, status: 415 });
  });

  it("rejects svg, which can carry script", () => {
    const result = validatePhotoUpload(
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'),
    );
    expect(result).toMatchObject({ ok: false, status: 415 });
  });

  it("rejects an empty file", () => {
    expect(validatePhotoUpload(Buffer.alloc(0))).toMatchObject({
      ok: false,
      status: 400,
    });
  });

  it("rejects a file over the size limit", () => {
    const big = Buffer.concat([JPEG, Buffer.alloc(MAX_PHOTO_BYTES)]);
    expect(validatePhotoUpload(big)).toMatchObject({ ok: false, status: 413 });
  });
});

describe("isServablePhotoType", () => {
  it("allows raster image types only", () => {
    expect(isServablePhotoType("image/jpeg")).toBe(true);
    expect(isServablePhotoType("image/png")).toBe(true);
    expect(isServablePhotoType("image/webp")).toBe(true);
    expect(isServablePhotoType("image/svg+xml")).toBe(false);
    expect(isServablePhotoType("text/html")).toBe(false);
    expect(isServablePhotoType("application/pdf")).toBe(false);
  });
});
