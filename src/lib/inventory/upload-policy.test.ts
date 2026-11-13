import { describe, expect, it } from "vitest";
import {
  MAX_PHOTO_BYTES,
  isIssuedPhotoKey,
  isPhotoMimeType,
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

describe("isIssuedPhotoKey", () => {
  const UUID = "3f2b1c1e-8a4d-4c57-9b1e-0d6a5c7e9f10";

  it("accepts the two shapes storage hands out", () => {
    expect(isIssuedPhotoKey("drive:1AbC_dEfGhIjKlMnOpQrStUvWxYz-012345")).toBe(true);
    expect(isIssuedPhotoKey(`local:temp/${UUID}.jpg`)).toBe(true);
    expect(isIssuedPhotoKey(`local:BX-00042/${UUID}.png`)).toBe(true);
    expect(isIssuedPhotoKey(`local:temp/${UUID}.webp`)).toBe(true);
  });

  it("refuses paths, other schemes and anything that is not a string", () => {
    for (const key of [
      "",
      "drive:",
      "drive:short",
      "drive:abc/def-0123456789",
      "drive:abc..def0123456789",
      "drive:abc def0123456789",
      `drive:${"a".repeat(300)}`,
      `local:${UUID}.jpg`,
      `local:../${UUID}.jpg`,
      `local:./${UUID}.jpg`,
      `local:temp/../${UUID}.jpg`,
      `local:a/b/${UUID}.jpg`,
      `local:temp/${UUID}.svg`,
      `local:temp/${UUID}.JPG`,
      `local:temp/${UUID}`,
      "local:temp/photo.jpg",
      ` local:temp/${UUID}.jpg`,
      `local:temp/${UUID}.jpg\n`,
      `LOCAL:temp/${UUID}.jpg`,
      "fixture:orbital-sander-front",
      "https://example.com/a.jpg",
    ]) {
      expect(isIssuedPhotoKey(key), JSON.stringify(key)).toBe(false);
    }
    for (const key of [null, undefined, 42, {}, [`local:temp/${UUID}.jpg`]]) {
      expect(isIssuedPhotoKey(key)).toBe(false);
    }
  });
});

describe("isPhotoMimeType", () => {
  it("accepts exactly the three upload types", () => {
    expect(isPhotoMimeType("image/jpeg")).toBe(true);
    expect(isPhotoMimeType("image/png")).toBe(true);
    expect(isPhotoMimeType("image/webp")).toBe(true);
  });

  it("refuses everything else, including padded or parameterised values", () => {
    for (const type of [
      "image/svg+xml",
      "text/html",
      "image/gif",
      "IMAGE/JPEG",
      "image/jpeg; charset=utf-8",
      " image/jpeg",
      "",
      null,
      undefined,
      7,
    ]) {
      expect(isPhotoMimeType(type), JSON.stringify(type)).toBe(false);
    }
  });
});
