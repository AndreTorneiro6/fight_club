import { challengeTeamName } from "./team-competition";
import type { View } from "./types";
import { adminGroups } from "./admin-sections";
import {
  managementLinks,
  playerLinks,
  spectatorLinks,
} from "./workspace-routes";
export interface SearchEntry {
  id: string;
  label: string;
  description: string;
  href: string;
  keywords: string;
  kind: string;
}
export const normalizeSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-PT")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const aliases: Record<string, string> = {
  notes: "ideias notas editor plans",
  gamification: "gamificar avatar cartoon cartas beber drinking social",
  coins: "dinheiro virtual moedas bar recompensas bebida",
  sponsors: "patrocinadores sponsors",
  engagement: "cartoes cards palpites predictions",
  matchmaking: "jornadas emparelhamento desafios",
  weekly: "papeis ataque defesa",
  payments: "pagamentos quotas mensalidade",
  registration: "inscricao convites",
  courts: "campos playtomic disponibilidade",
  album: "caderneta cromos shake",
  rules: "regras configuracao settings",
  posters: "cartazes exportar whatsapp ranking papeis",
};
/** Index only state already authorized for the effective workspace. No audit, email or note-body indexing. */
export function searchEntries(state: View): SearchEntry[] {
  const admin = state.actor.role === "admin",
    entries: SearchEntry[] = [];
  const add = (
    id: string,
    label: string,
    description: string,
    href: string,
    keywords = "",
    kind = "Área",
  ) => entries.push({ id, label, description, href, keywords, kind });
  const links = admin
    ? managementLinks
    : state.actor.role === "spectator"
      ? ([
          ["ranking", "Ranking"],
          ["jogos", "Jogos"],
          ["apostas", "Central de Apostas"],
          ["perfil", "Perfil"],
          ...spectatorLinks,
        ] as const)
      : ([
          ["inicio", "Início"],
          ["ranking", "Ranking"],
          ["desafios", "Desafios"],
          ["jogos", "Jogos"],
          ["apostas", "Central de Apostas"],
          ["perfil", "Perfil"],
          ...playerLinks,
        ] as const);
  for (const [path, label] of links.filter(
    ([path]) => path !== "caderneta" || state.stickerAccess?.enabled,
  ))
    add(
      `page:${path}`,
      label,
      "Navegação da liga",
      `/${path}`,
      path === "jogos"
        ? "calendario agenda marcar disponibilidade playtomic"
        : "",
    );
  add(
    "page:notifications",
    "Notificações",
    "Avisos e mensagens",
    "/notificacoes",
  );
  if (admin) {
    for (const group of adminGroups)
      for (const [tab, label] of group.items)
        add(
          `admin:${tab}`,
          label,
          `Administração · ${group.label}`,
          `/admin?tab=${tab}`,
          aliases[tab] ?? "",
        );
    add(
      "admin:profile",
      "Perfil",
      "Conta e fotografia pessoal",
      "/perfil",
      "foto password palavra passe",
    );
    for (const p of state.players.filter((p) => p.status !== "removed"))
      add(
        `player:${p._id}`,
        p.name,
        "Abrir na gestão de jogadores",
        `/admin?tab=players&q=${encodeURIComponent(p.name)}&registration=${p.registrationRejectedAt ? "rejected" : p.awaitingApproval ? "pending" : "approved"}`,
        "jogador equipa",
        "Jogador",
      );
  }
  for (const c of state.challenges) {
    const ids = [
      c.challengerId,
      c.defenderId,
      ...(c.challengerTeam ?? []).map((p) => p.playerId),
      ...(c.defenderTeam ?? []).map((p) => p.playerId),
    ];
    if (
      state.actor.role === "spectator" ||
      (!admin && !ids.includes(state.actor.playerId))
    )
      continue;
    if (c.competitionRoundId && !c.officialPublication) continue;
    const name = (id: string) => challengeTeamName(c, id, state.players);
    add(
      `match:${c._id}`,
      `Jogo #${c.number}`,
      `${name(c.challengerId)} × ${name(c.defenderId)}`,
      `/desafios/${encodeURIComponent(c._id)}`,
      `desafio ${c.number} ${c.status}`,
      "Jogo",
    );
  }
  for (const sponsor of (state.sponsors ?? []).filter(
    (p) => p.published && state.actor.role !== "spectator",
  ))
    add(
      `sponsor:${sponsor._id}`,
      sponsor.name,
      "Patrocinador da liga",
      `/patrocinios#sponsor-${sponsor._id}`,
      sponsor.label,
      "Patrocinador",
    );
  return entries;
}
export function findSearchEntries(
  entries: SearchEntry[],
  query: string,
  limit = 20,
) {
  const words = normalizeSearch(query.slice(0, 120)).split(" ").filter(Boolean);
  return entries
    .map((entry, index) => ({
      entry,
      index,
      label: normalizeSearch(entry.label),
      text: normalizeSearch(
        `${entry.label} ${entry.description} ${entry.keywords}`,
      ),
    }))
    .filter((e) => words.every((word) => e.text.includes(word)))
    .sort((a, b) => {
      const score = (x: typeof a) =>
        words.length
          ? (x.label === words.join(" ") ? 100 : 0) +
            words.reduce(
              (n, w) =>
                n + (x.label.startsWith(w) ? 10 : x.label.includes(w) ? 5 : 0),
              0,
            )
          : 0;
      return score(b) - score(a) || a.index - b.index;
    })
    .slice(0, limit)
    .map((x) => x.entry);
}
