import type { Notification } from "./types";
/** One target for in-app, push and provider delivery. Private content still checks the recipient on read. */
export function notificationTarget(n: Notification): string {
  if (n.stickerReportId)
    return `/admin?tab=album&report=${encodeURIComponent(n.stickerReportId)}${n.seasonId ? `&epoca=${encodeURIComponent(n.seasonId)}` : ""}`;
  if (n.stickerTradeId)
    return `/caderneta?negociacao=${encodeURIComponent(n.stickerTradeId)}${n.seasonId ? `&epoca=${encodeURIComponent(n.seasonId)}` : ""}${n.chatMessageId ? `#mensagem-${encodeURIComponent(n.chatMessageId)}` : ""}`;
  if (n.bettingNotice)
    return `/apostas${n.challengeId ? `?jogo=${encodeURIComponent(n.challengeId)}` : ""}${n.chatMessageId ? `#mensagem-${encodeURIComponent(n.chatMessageId)}` : ""}`;
  if (n.weeklyChallengeOpening) return "/desafios";
  if (n.rankingNotice) return "/ranking";
  if (n.seasonId) return "/epocas";
  if (n.adminTestId)
    return `/admin?tab=simulation&test=${encodeURIComponent(n.adminTestId)}`;
  if (n.challengeId)
    return `/desafios/${encodeURIComponent(n.challengeId)}${n.chatMessageId ? `#mensagem-${encodeURIComponent(n.chatMessageId)}` : ""}`;
  if (n.competitionNotice)
    return n.playerId === "__admins__" ? "/admin?tab=matchmaking" : "/jornadas";
  return "/notificacoes";
}
