/** Public social profiles for The Box / Discover Burien Makerspace. */
export const SOCIAL_LINKS = {
  facebook: {
    href: "https://www.facebook.com/DiscoverBurienMakerspace",
    label: "Facebook",
  },
  instagram: {
    href: "https://www.instagram.com/burienmakerspace/",
    label: "Instagram",
  },
} as const;

export type ProjectHighlight = {
  id: string;
  title: string;
  maker: string;
  area: string;
  caption: string;
  /** Local path under /public, or absolute URL later. */
  imageSrc: string;
  imageAlt: string;
};

/**
 * Curated “Made at The Box” reel. Images live in public/images/projects/.
 * Replace with real member photos when available.
 */
export const PROJECT_HIGHLIGHTS: ProjectHighlight[] = [
  {
    id: "proj-laser-sign",
    title: "Neighborhood wayfinding",
    maker: "Maya",
    area: "Laser",
    caption: "CO₂ laser cut birch plywood for a block party map.",
    imageSrc: "/images/projects/proj-laser-sign.png",
    imageAlt: "Laser-cut birch plywood neighborhood map on a workbench",
  },
  {
    id: "proj-3d-jig",
    title: "Shop jig, printed in-house",
    maker: "Jordan",
    area: "3D printing",
    caption: "Custom hold-down printed on the Prusa for a weekend build.",
    imageSrc: "/images/projects/proj-3d-jig.png",
    imageAlt: "Black 3D-printed woodworking hold-down jig beside a printer",
  },
  {
    id: "proj-textile-banner",
    title: "Club banner",
    maker: "Sam",
    area: "Textiles",
    caption: "Embroidery + vinyl for a youth robotics team night.",
    imageSrc: "/images/projects/proj-textile-banner.png",
    imageAlt: "Embroidered and vinyl robotics club banner on a sewing table",
  },
  {
    id: "proj-wood-shelf",
    title: "Floating shelf set",
    maker: "Riley",
    area: "Woodshop",
    caption: "First table-saw project after woodshop basics checkoff.",
    imageSrc: "/images/projects/proj-wood-shelf.png",
    imageAlt: "Pair of light oak floating shelves on a white wall",
  },
  {
    id: "proj-sub-merch",
    title: "Volunteer merch drop",
    maker: "Avery",
    area: "Sublimation",
    caption: "Sawgrass prints for Shop Steward thank-you shirts.",
    imageSrc: "/images/projects/proj-sub-merch.png",
    imageAlt: "Stack of sublimation-printed volunteer t-shirts by a heat press",
  },
  {
    id: "proj-open-studio",
    title: "Open studio night build",
    maker: "Quinn",
    area: "Mixed",
    caption: "Laser inlay + hand finish during Friday open hours.",
    imageSrc: "/images/projects/proj-open-studio.png",
    imageAlt: "Wood panel with contrasting laser inlay and oil finish",
  },
];
