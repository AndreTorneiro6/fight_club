export type CromoDivision = "ouro" | "prata" | "bronze";
export type CromoRect = readonly [number, number, number, number];
const goldValues = Array.from(
  { length: 6 },
  (_, i) => [808, 836 + i * 82.5, 88, 58] as const,
);
const silverValues = Array.from(
  { length: 6 },
  (_, i) => [598, 594 + i * 59, 67, 41] as const,
);
const bronzeValues = Array.from(
  { length: 6 },
  (_, i) => [1308, 594 + i * 59, 67, 41] as const,
);
export const cromoLayouts = {
  ouro: {
    original: "/cromos/original-ouro.jpeg",
    restored: "/cromos/fields-ouro.webp",
    image: [1024, 1536],
    crop: [0, 0, 1024, 1536],
    rating: [100, 270, 248, 202],
    initials: [160, 472, 145, 83],
    name: [175, 645, 655, 112],
    photo: [379, 176, 399, 446],
    corner: 40,
    values: goldValues,
    light: "#ffefae",
    dark: "#c29435",
  },
  prata: {
    original: "/cromos/original-prata-bronze.jpeg",
    restored: "/cromos/fields-prata-bronze.webp",
    image: [1458, 1079],
    crop: [0, 0, 737, 1079],
    rating: [86, 199, 175, 143],
    initials: [135, 343, 85, 54],
    name: [165, 458, 464, 78],
    photo: [294, 133, 274, 308],
    corner: 24,
    values: silverValues,
    light: "#f7f9ff",
    dark: "#a6acb4",
  },
  bronze: {
    original: "/cromos/original-prata-bronze.jpeg",
    restored: "/cromos/fields-prata-bronze.webp",
    image: [1458, 1079],
    crop: [756, 0, 702, 1079],
    rating: [831, 199, 175, 143],
    initials: [874, 343, 85, 54],
    name: [903, 458, 466, 78],
    photo: [1030, 133, 278, 308],
    corner: 24,
    values: bronzeValues,
    light: "#ffe3bb",
    dark: "#d87d36",
  },
} as const;
export const cromoAssetPaths = new Set<string>(
  Object.values(cromoLayouts).flatMap((layout) => [
    layout.original,
    layout.restored,
  ]),
);
