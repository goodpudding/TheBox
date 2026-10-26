import { redirect } from "next/navigation";
import { normalizeAssetTag } from "@/lib/inventory/tags";

export default async function InventoryShortLinkPage({
  params,
}: {
  params: Promise<{ assetTag: string }>;
}) {
  const { assetTag } = await params;
  const tag = normalizeAssetTag(decodeURIComponent(assetTag)) ?? assetTag;
  redirect(`/inventory/${tag}`);
}
