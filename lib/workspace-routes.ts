/** Only private management pages require the effective admin workspace. */
export const adminOnlyRoutes = new Set(["admin", "ajuda/admin"]);
export const leagueInformationLinks = [
  ["title-fight", "Title Fight"],
  ["campeoes", "Hall of Champions"],
  ["epocas", "Épocas"],
  ["estatisticas", "Estatísticas"],
  ["regras", "Regras"],
  ["premios", "Prémios"],
  ["patrocinios", "Patrocínios"],
] as const;
export const managementLinks = [
  ["admin", "Administração"],
  ...leagueInformationLinks,
  ["ajuda/admin", "Manual do administrador"],
] as const;
export const playerLinks = [
  ["jornadas", "Jornadas oficiais"],
  ["cartoes", "Cartões de jogador"],
  ["palpites", "Palpites dos jogos"],
  ...leagueInformationLinks,
  ["ajuda", "Como usar a app"],
] as const;
export function isManagementRoute(route: string) {
  return (
    adminOnlyRoutes.has(route) ||
    leagueInformationLinks.some(([path]) => path === route) ||
    ["perfil", "notificacoes", "desafios", "jogos"].includes(route) ||
    route.startsWith("desafios/")
  );
}
