"use client";

import { useEffect, useState } from "react";
import { useData } from "@/components/providers";
import type { DataProvider, SiteInfo } from "@/lib/data";
import { DEFAULT_SITE_INFO } from "@/lib/data/site-info";

/** The footer and the social links all ask at once. One request serves them. */
let shared: { provider: DataProvider; revision: number; info: Promise<SiteInfo> } | null =
  null;

function loadSiteInfo(provider: DataProvider, revision: number): Promise<SiteInfo> {
  if (!shared || shared.provider !== provider || shared.revision !== revision) {
    shared = { provider, revision, info: provider.getSiteInfo() };
  }
  return shared.info;
}

/**
 * Shop name, address and social links, as staff set them under
 * Admin → Settings. Shows the built-in details until the answer arrives.
 */
export function useSiteInfo(): SiteInfo {
  const { provider, revision } = useData();
  const [info, setInfo] = useState<SiteInfo>(DEFAULT_SITE_INFO);

  useEffect(() => {
    let cancelled = false;
    loadSiteInfo(provider, revision)
      .then((next) => {
        if (!cancelled) setInfo(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [provider, revision]);

  return info;
}
