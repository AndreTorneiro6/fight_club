export const socialKeys = ["bar", "banter", "partner", "fairplay"] as const;
export type SocialKey = (typeof socialKeys)[number];
export interface AvatarStyle {
  skin: string;
  hairColor: string;
  shirt: string;
  background: string;
  hair: "short" | "wave" | "long" | "bald";
  expression: "smile" | "focused";
  glasses: boolean;
  beard: boolean;
}
export interface GamificationSettings {
  _id: string;
  version: number;
  frontTitle: string;
  backTitle: string;
  labels: Record<SocialKey, string>;
  updatedAt?: string;
  updatedBy?: string;
}
export interface GamificationProfile {
  _id: string;
  playerId: string;
  version: number;
  nickname: string;
  avatar: AvatarStyle;
  social: Record<SocialKey, number>;
  createdAt: string;
  updatedAt: string;
  updatedBy: string;
}
export const defaultGamificationSettings: GamificationSettings = {
  _id: "gamification",
  version: 0,
  frontTitle: "Dentro de campo",
  backTitle: "Fora de campo",
  labels: {
    bar: "Espírito de bar",
    banter: "Provocação amigável",
    partner: "Bom parceiro",
    fairplay: "Fair play",
  },
};
export const defaultAvatar: AvatarStyle = {
  skin: "#c98e69",
  hairColor: "#30241f",
  shirt: "#cfab46",
  background: "#173c48",
  hair: "short",
  expression: "smile",
  glasses: false,
  beard: false,
};
export const defaultSocial: Record<SocialKey, number> = {
  bar: 0,
  banter: 0,
  partner: 0,
  fairplay: 0,
};
