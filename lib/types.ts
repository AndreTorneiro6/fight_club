export type DivisionCode = "ouro" | "prata" | "bronze";
export type ChallengeStatus =
  | "pending"
  | "accepted"
  | "schedule_pending"
  | "scheduled"
  | "result_pending"
  | "disputed"
  | "completed"
  | "refused"
  | "cancelled"
  | "expired";
export interface Entity {
  _id: string;
}
export interface Player extends Entity {
  awaitingApproval?: boolean;
  notificationPreferences?: {
    email: boolean;
    whatsapp: boolean;
    whatsappConsentAt?: string;
  };
  userId?: string;
  name: string;
  email: string;
  phone: string;
  photo: string;
  number: number;
  divisionId: string;
  position: number;
  previousPosition: number;
  status: "active" | "inactive" | "suspended" | "removed";
  partner: string;
  wins: number;
  losses: number;
  challengesWon: number;
  challengesLost: number;
  createdAt: string;
}
export interface Division extends Entity {
  code: DivisionCode;
  name: string;
  tier: number;
  capacity: number;
}
export interface Settings extends Entity {
  requireClubConfirmation: boolean;
  initialSuggestionCount: 3 | 4;
  rulesText: string;
  prizes: Prize[];
  maxPositionsAbove: number;
  maxActiveChallenges: number;
  minDaysBetween: number;
  acceptHours: number;
  scheduleDays: number;
  playDays: number;
  matchMinutes: number;
  slotStepMinutes: number;
  rankingModel: "swap" | "leapfrog";
  refusalRule: "busy_only" | "reason" | "forfeit";
  cancellationRule: "admin_only" | "participants";
  reminderHours: number;
  promotionCount: number;
  relegationCount: number;
  promotionPlacement: "top" | "bottom";
  relegationPlacement: "top" | "bottom";
  titleMaxPosition: number;
  titleChangesOnWin: boolean;
  titleAffectsRanking: boolean;
  seasonMonths: number;
  extendDays: number;
  extendResponseHours: number;
}
export interface Prize {
  title: string;
  description: string;
  divisionId: string;
  placement: string;
}
export interface Challenge extends Entity {
  scheduleProposal?: ScheduleProposal;
  number: number;
  seasonId: string;
  divisionId: string;
  challengerId: string;
  defenderId: string;
  challengerPosition: number;
  defenderPosition: number;
  status: ChallengeStatus;
  createdAt: string;
  respondBy: string;
  scheduleBy: string;
  playBy: string;
  refusalReason?: string;
  refusalNote?: string;
  scheduledAt?: string;
  courtId?: string;
  durationMinutes: number;
  winnerId?: string;
  score?: string;
  reportedBy?: string;
  disputeNote?: string;
  completedAt?: string;
  titleFight?: boolean;
  expiredFrom?: ChallengeStatus;
}
export interface ScheduleProposal {
  _id: string;
  start: string;
  courtId?: string;
  minutes: number;
  proposedBy: string;
  createdAt: string;
  challengerConfirmed: boolean;
  defenderConfirmed: boolean;
  clubConfirmed: boolean;
  previousStatus: "pending" | "accepted" | "scheduled";
  confirmedAt?: string;
}
export interface Slot extends Entity {
  offeredBy?: string;
  challengeId: string;
  playerId: string;
  start: string;
  end: string;
}
export interface Availability extends Entity {
  playerId: string;
  weekday: number;
  start: string;
  end: string;
}
export interface Exception extends Entity {
  playerId: string;
  from: string;
  to: string;
  note: string;
}
export interface Message extends Entity {
  audienceIds?: string[];
  challengeId: string;
  playerId: string;
  text: string;
  createdAt: string;
}
export interface Notification extends Entity {
  playerId: string;
  title: string;
  body: string;
  challengeId?: string;
  read: boolean;
  createdAt: string;
  dedupe?: string;
}
export interface History extends Entity {
  playerId: string;
  divisionId: string;
  oldPosition: number;
  newPosition: number;
  reason: string;
  challengeId?: string;
  createdAt: string;
}
export interface Audit extends Entity {
  userId: string;
  action: string;
  details: string;
  createdAt: string;
}
export interface Court extends Entity {
  playtomicResourceId?: string;
  name: string;
  active: boolean;
}
export interface Match extends Entity {
  challengeId: string;
  courtId?: string;
  start: string;
  end: string;
  seasonId: string;
}
export interface Result extends Entity {
  challengeId: string;
  winnerId: string;
  loserId: string;
  score: string;
  confirmedAt: string;
  seasonId: string;
}
export interface Champion extends Entity {
  divisionId: string;
  playerId: string;
  since: string;
  until?: string;
  defenses: number;
  seasonId: string;
}
export interface Season extends Entity {
  name: string;
  start: string;
  end: string;
  pauseStart: string;
  pauseEnd: string;
  status: "draft" | "active" | "paused" | "completed";
  archivedRankings?: Player[];
}
export interface RegistrationLink extends Entity {
  label: string;
  tokenHash: string;
  expiresAt: string;
  maxUses: number;
  uses: number;
  active: boolean;
  createdAt: string;
}
export interface State {
  registrationLinks: RegistrationLink[];
  players: Player[];
  divisions: Division[];
  settings: Settings[];
  challenges: Challenge[];
  slots: Slot[];
  availability: Availability[];
  exceptions: Exception[];
  messages: Message[];
  notifications: Notification[];
  history: History[];
  audit: Audit[];
  courts: Court[];
  matches: Match[];
  results: Result[];
  champions: Champion[];
  seasons: Season[];
}
export const collections = [
  "registrationLinks",
  "players",
  "divisions",
  "settings",
  "challenges",
  "slots",
  "availability",
  "exceptions",
  "messages",
  "notifications",
  "history",
  "audit",
  "courts",
  "matches",
  "results",
  "champions",
  "seasons",
] as const;
export interface Actor {
  userId: string;
  playerId: string;
  role: "admin" | "player";
}
export interface User extends Entity {
  privacyAcceptedAt?: string;
  privacyVersion?: string;
  email: string;
  name: string;
  passwordHash: string;
  role: "admin" | "player";
  createdAt: string;
  verified?: boolean;
}
export interface Session extends Entity {
  userId: string;
  expiresAt: Date;
}
export interface View extends State {
  actor: Actor;
  demo: boolean;
}

export const defaultSettings: Settings = {
  requireClubConfirmation: true,
  _id: "league",
  initialSuggestionCount: 4,
  rulesText: "",
  prizes: [],
  maxPositionsAbove: 3,
  maxActiveChallenges: 2,
  minDaysBetween: 0,
  acceptHours: 48,
  scheduleDays: 5,
  playDays: 14,
  matchMinutes: 90,
  slotStepMinutes: 30,
  rankingModel: "swap",
  refusalRule: "busy_only",
  cancellationRule: "admin_only",
  reminderHours: 24,
  promotionCount: 3,
  relegationCount: 3,
  promotionPlacement: "bottom",
  relegationPlacement: "top",
  titleMaxPosition: 3,
  titleChangesOnWin: true,
  titleAffectsRanking: true,
  seasonMonths: 6,
  extendDays: 7,
  extendResponseHours: 48,
};
export const statusLabels: Record<string, string> = {
  pending: "A aguardar resposta",
  accepted: "A marcar",
  schedule_pending: "A confirmar horário",
  scheduled: "Marcado",
  result_pending: "Resultado por validar pelo admin",
  disputed: "Em disputa",
  completed: "Concluído",
  refused: "Recusado",
  cancelled: "Cancelado",
  expired: "Expirado",
  live: "A decorrer",
};
