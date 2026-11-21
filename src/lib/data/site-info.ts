/**
 * Starting values for the shop details and the "Made at the makerspace" gallery.
 * Fixture mode shows these. The live site shows what is in the database:
 * the gallery rows were copied there once by a migration, and the shop
 * details fall back to these until staff save their own.
 */
import projects from "../../../data/mock/projects.json";
import type { Project, SiteInfo } from "./types";

export const DEFAULT_SITE_INFO: SiteInfo = {
  orgName: "Discover Burien Makerspace",
  addressLine: "611 SW 152nd St (lower level) · access from SW 153rd · Burien, WA",
  blurb:
    "A community makerspace in Burien, WA, run by Discover Burien. Membership, classes, and machine access live here — the rest of our public story lives on discoverburien.org.",
  facebookUrl: "https://www.facebook.com/DiscoverBurienMakerspace",
  instagramUrl: "https://www.instagram.com/burienmakerspace/",
};

export const DEFAULT_PROJECTS = projects as Project[];

/** A link staff typed. It has to be an http(s) address. */
export function webAddress(value: unknown, label: string): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > 500 || !/^https?:\/\/[^\s<>"]+$/i.test(text)) {
    throw new Error(`${label} must be a web address that starts with https://`);
  }
  return text;
}

/** Where a gallery picture comes from: a path on this site, or an https address. */
export function pictureAddress(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  const local = /^\/(?!\/)[A-Za-z0-9._~%\/-]+$/.test(text);
  const remote = /^https:\/\/[^\s<>"]+$/i.test(text);
  if (!text || text.length > 500 || !(local || remote)) {
    throw new Error("Add a picture: upload one, or paste an address that starts with https://");
  }
  return text;
}
