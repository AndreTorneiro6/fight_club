export const attributeKeys = [
  "speed",
  "smash",
  "lob",
  "volley",
  "defense",
  "physic",
] as const;
export type AttributeKey = (typeof attributeKeys)[number];
export type PadelAttributes = Record<AttributeKey, number>;
export interface PlayerAttributes {
  _id: string;
  playerId: string;
  version: number;
  overall?: number;
  attributes: PadelAttributes;
  createdAt: string;
  updatedAt: string;
}
/** Equal weights, rounded to nearest integer; never used for competition ranking. */
export function personalRating(attributes: PadelAttributes): number {
  return Math.round(
    attributeKeys.reduce((sum, key) => sum + attributes[key], 0) /
      attributeKeys.length,
  );
}

/** Legacy assessments remain readable without overwriting historical documents. */
export function normalizePlayerAttributes(
  record: PlayerAttributes,
): PlayerAttributes {
  const old = record.attributes as unknown as Record<
    string,
    number | undefined
  >;
  const mappings = {
    speed: "speed",
    smash: "attack",
    lob: "control",
    volley: "technique",
    defense: "defense",
    physic: "stamina",
  };
  const attributes = Object.fromEntries(
    attributeKeys.map((key) => [key, old[key] ?? old[mappings[key]] ?? 50]),
  ) as PadelAttributes;
  return {
    ...record,
    attributes,
    overall: record.overall ?? personalRating(attributes),
  };
}
