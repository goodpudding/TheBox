import { describe, expect, it } from "vitest";
import {
  extractDriveId,
  googleDocHtmlToContentHtml,
  parseContentIndexCsv,
  resolveDocFromPath,
  safeFileName,
  slugify,
  splitTitleVersion,
} from "./content";
import { parseServiceAccount } from "./config";
import { buildServiceAccountJwt } from "./auth";
import { generateKeyPairSync, createVerify } from "node:crypto";

describe("extractDriveId", () => {
  it("accepts bare ids and every common URL shape", () => {
    const id = "1ncdYmW0w5XG7Q8pNkBXHdJRd1thiXY016wFgab2T9MA";
    expect(extractDriveId(id)).toBe(id);
    expect(
      extractDriveId(`https://docs.google.com/spreadsheets/d/${id}/edit?usp=drivesdk`),
    ).toBe(id);
    expect(extractDriveId(`https://docs.google.com/document/d/${id}/edit`)).toBe(id);
    expect(extractDriveId(`https://drive.google.com/drive/folders/${id}?usp=drive_link`)).toBe(id);
    expect(extractDriveId(`https://drive.google.com/open?id=${id}`)).toBe(id);
    expect(extractDriveId("not a link")).toBeNull();
    expect(extractDriveId("")).toBeNull();
  });
});

describe("slugify / safeFileName / splitTitleVersion", () => {
  it("makes readable slugs", () => {
    expect(slugify("Storage & Abandoned Property")).toBe("storage-and-abandoned-property");
    expect(slugify("  Guests — and Minors!  ")).toBe("guests-and-minors");
    expect(slugify("Café Hours")).toBe("cafe-hours");
  });

  it("keeps extensions on media names", () => {
    expect(safeFileName("Boo in Burien Flyer (final).PDF")).toBe("boo-in-burien-flyer-final.pdf");
    expect(safeFileName("IMG_2041.jpeg")).toBe("img-2041.jpeg");
    expect(safeFileName("Untitled")).toBe("untitled");
  });

  it("pulls a version hint off a Doc title", () => {
    expect(splitTitleVersion("Waiver v2026.2")).toEqual({ title: "Waiver", version: "2026.2" });
    expect(splitTitleVersion("Waiver (v3)")).toEqual({ title: "Waiver", version: "3" });
    expect(splitTitleVersion("Member Expectations")).toEqual({
      title: "Member Expectations",
      version: null,
    });
  });
});

describe("resolveDocFromPath", () => {
  it("maps root docs and subfolders to categories", () => {
    expect(resolveDocFromPath("Waiver v2026.2", [])).toEqual({
      slug: "waiver",
      title: "Waiver",
      category: "waiver",
      version: "2026.2",
    });
    expect(resolveDocFromPath("Hours of Operation", [])).toMatchObject({
      slug: "hours",
      category: "hours",
    });
    expect(resolveDocFromPath("Member Expectations", ["Policies"])).toMatchObject({
      slug: "member-expectations",
      category: "policy",
    });
    expect(resolveDocFromPath("Materials", ["Learning", "3D Printing"])).toMatchObject({
      slug: "3d-printing-materials",
      category: "lesson",
    });
    expect(resolveDocFromPath("Something", ["Random"])).toMatchObject({ category: "other" });
    // A stray Doc at the root of Content/ is treated as a policy page.
    expect(resolveDocFromPath("Guests and Minors", [])).toMatchObject({ category: "policy" });
  });
});

describe("parseContentIndexCsv", () => {
  it("reads slug/title/category/doc/published/version in any column order", () => {
    const csv = [
      "Title,Doc,Category,Slug,Published,Version",
      '"Liability Waiver",https://docs.google.com/document/d/1AAAAAAAAAAAAAAAAAAAAAAAA/edit,waiver,waiver,yes,2026.2',
      "Member Expectations,1BBBBBBBBBBBBBBBBBBBBBBBB,policies,,no,",
      "Broken row,not-a-link,policy,broken,yes,",
      "",
    ].join("\r\n");
    const rows = parseContentIndexCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      slug: "waiver",
      title: "Liability Waiver",
      category: "waiver",
      fileId: "1AAAAAAAAAAAAAAAAAAAAAAAA",
      published: true,
      version: "2026.2",
    });
    expect(rows[1]).toMatchObject({
      slug: "member-expectations",
      category: "policy",
      published: false,
      version: null,
    });
  });
});

describe("googleDocHtmlToContentHtml", () => {
  const exportHtml = `<html><head><meta content="text/html; charset=UTF-8" http-equiv="content-type">
<style type="text/css">.c0{font-weight:700}.c1{font-style:italic}.c2{text-decoration:underline;color:#1155cc}.c3{padding-top:0pt}.title{font-size:26pt}</style></head>
<body class="c9 doc-content">
<p class="title" id="h.abc"><span class="c5">Member Expectations</span></p>
<p class="c3"><span class="c0">Safety first.</span><span> Clean your station and </span><span class="c1">ask</span><span> when unsure.</span></p>
<p class="c3"><span class="c5"></span></p>
<h2 class="c7"><span class="c0">Certifications</span></h2>
<ul class="c8 lst-kix_1-0 start"><li class="c3 li-bullet-0"><span>Never use equipment you are not certified for.</span></li></ul>
<p class="c3"><span>See </span><a class="c2" href="https://www.google.com/url?q=https://discoverburien.org/makerspace&amp;sa=D&amp;source=editors"><span class="c2">the site</span></a><span>.</span></p>
<p class="c3"><span style="overflow:hidden"><img alt="" src="https://lh7-us.googleusercontent.com/abc" style="width:400px;height:200px" title=""></span></p>
<script>alert(1)</script>
</body></html>`;

  it("keeps structure and inline emphasis, drops Google chrome", () => {
    const html = googleDocHtmlToContentHtml(exportHtml);
    expect(html).toContain("<h1>Member Expectations</h1>");
    expect(html).toContain("<strong>Safety first.</strong> Clean your station and <em>ask</em> when unsure.");
    expect(html).toContain("<h2>Certifications</h2>");
    expect(html).toContain("<ul><li>Never use equipment you are not certified for.</li></ul>");
    expect(html).toContain('<a href="https://discoverburien.org/makerspace">the site</a>');
    expect(html).toContain('<img src="https://lh7-us.googleusercontent.com/abc" alt="" />');
    expect(html).not.toContain("class=");
    expect(html).not.toContain("style=");
    expect(html).not.toContain("<span");
    expect(html).not.toContain("script");
    expect(html).not.toMatch(/<p>\s*<\/p>/);
  });

  it("handles fragments without a <body>", () => {
    expect(googleDocHtmlToContentHtml("<p>Hi</p>")).toBe("<p>Hi</p>");
  });
});

describe("service account parsing + JWT", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

  it("parses inline JSON and normalizes escaped newlines", () => {
    const json = JSON.stringify({
      client_email: "sync@example.iam.gserviceaccount.com",
      private_key: pem.replace(/\n/g, "\\n"),
    });
    const acct = parseServiceAccount(json);
    expect(acct?.client_email).toBe("sync@example.iam.gserviceaccount.com");
    expect(acct?.private_key).toBe(pem);
    expect(parseServiceAccount("")).toBeNull();
    expect(parseServiceAccount("{not json")).toBeNull();
    expect(parseServiceAccount('{"client_email":"x"}')).toBeNull();
  });

  it("signs a JWT Google will accept (RS256, iss/scope/aud/iat/exp)", () => {
    const jwt = buildServiceAccountJwt(
      { client_email: "sync@example.iam.gserviceaccount.com", private_key: pem },
      ["https://www.googleapis.com/auth/drive.readonly"],
      1_700_000_000,
    );
    const [h, c, s] = jwt.split(".");
    const header = JSON.parse(Buffer.from(h, "base64url").toString());
    const claims = JSON.parse(Buffer.from(c, "base64url").toString());
    expect(header).toMatchObject({ alg: "RS256", typ: "JWT" });
    expect(claims).toEqual({
      iss: "sync@example.iam.gserviceaccount.com",
      scope: "https://www.googleapis.com/auth/drive.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: 1_700_000_000,
      exp: 1_700_003_600,
    });
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${h}.${c}`);
    expect(verifier.verify(publicKey, Buffer.from(s, "base64url"))).toBe(true);
  });
});
