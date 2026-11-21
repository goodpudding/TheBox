import { describe, expect, it } from "vitest";
import { readJson } from "./read-json";

describe("readJson", () => {
  it("returns the parsed body", async () => {
    expect(await readJson<{ ok: boolean }>(Response.json({ ok: true }))).toEqual({ ok: true });
  });

  it("returns null for an empty crash reply", async () => {
    expect(await readJson(new Response(null, { status: 500 }))).toBeNull();
  });

  it("returns null for a plain-text error page", async () => {
    expect(await readJson(new Response("Internal Server Error", { status: 500 }))).toBeNull();
    expect(await readJson(new Response("error code: 1102", { status: 503 }))).toBeNull();
  });
});
