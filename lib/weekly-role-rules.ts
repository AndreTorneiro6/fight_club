/**
 * Weekly roles. `super_attack` is the stored id of Combo, kept so saved rounds
 * need no data migration.
 */
export type WeeklyRole = "attack" | "defense" | "super_attack";

/** Ataque and Combo may launch a challenge. */
export const canChallenge = (role?: string) =>
  role === "attack" || role === "super_attack";

/** Defesa and Combo may receive a challenge. */
export const canBeChallenged = (role?: string) =>
  role === "defense" || role === "super_attack";

export const weeklyRoleName = (role?: string) =>
  role === "super_attack"
    ? "Combo"
    : role === "attack"
      ? "Ataque"
      : role === "defense"
        ? "Defesa"
        : "Por atribuir";
