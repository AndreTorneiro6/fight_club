import type { MatchVoteSummary } from "./anonymous-match-votes";
import type { ClubPhoto, ClubPhotoUnlock } from "./club-photo-types";
import type { MatchVotingSettings } from "./match-voting-targets";
import type { MatchVote, MatchDiscussionMessage } from "./match-voting";
import type { NotificationEvent } from "./notification-presentation";
import type { SetScore } from "./set-scores";
import type {
  AdminTestAccount,
  AdminTestChallenge,
  TestChannel,
} from "./admin-test-types";
import type { PlacementEvent } from "./placement-types";
import type {
  GamificationSettings,
  GamificationProfile,
} from "./gamification-types";
import type { Sponsor } from "./sponsor-types";
import type { CoinSettings, CoinEntry } from "./coin-types";
import type {
  StickerSettings,
  StickerPack,
  StickerReward,
} from "./sticker-types";
import type { AdminNote } from "./admin-notes";
import type { PlayerAttributes } from "./padel-attributes";
import type { EngagementSettings, Prediction } from "./predictions";
import type {
  CompetitionConfiguration,
  CompetitionRound,
  CompetitionSchedule,
  CompetitionAbsence,
  CompetitionRecovery,
  CompetitionChallenge,
} from "./competition-types";
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
export interface PaymentStatus {
  paid: boolean;
  updatedAt: string;
  updatedBy: string;
}
export interface Player extends Entity {
  /** Derived for API views; position remains an internal legacy ordering slot. */
  teamPosition?: number;
  previousTeamPosition?: number;
  membershipPayment?: PaymentStatus;
  awaitingApproval?: boolean;
  registrationRejectedAt?: string;
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
  partnerId?: string;
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
  weeklyCompetition: boolean;
  weeklyMandatoryChallenges?: boolean;
  weeklyDynamicRoles?: boolean;
  weeklyDynamicDivisionIds?: string[];
  divisionChallengeDistances?: Record<string, number>;
  autoWeeklyRoles?: boolean;
  roleDraftLeadDays?: number;
  autoWeeklyRanking?: boolean;
  weeklyRankingDay?: number;
  weeklyRankingHour?: number;
  requireClubConfirmation: boolean;
  initialSuggestionCount: 3 | 4;
  rulesText: string;
  prizes: Prize[];
  contentVersion?: number;
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
  sponsorId?: string;
  title: string;
  description: string;
  divisionId: string;
  placement: string;
}
export interface Challenge extends Entity {
  origin?: import("./challenge-origin").ChallengeOrigin;
  mandatoryAssignment?: boolean;
  effectiveChallengeDistance?: number;
  challengerTeamId?: string;
  defenderTeamId?: string;
  positionSnapshotModel?: "team";
  resultStatsPlayerIds?: string[];
  queueClosedByChallengeId?: string;
  queueClosureReason?: string;
  weeklyPriorityWinner?: boolean;
  weeklyPriorityReason?: string;
  competitionRoundId?: string;
  predictionCutoffAt?: string;
  officialPublication?: {
    roundId: string;
    scheduleId: string;
    version: number;
    publishedAt: string;
  };
  courtPayments?: (PaymentStatus & { playerId: string })[];
  challengerTeam?: { playerId: string; name: string }[];
  defenderTeam?: { playerId: string; name: string }[];
  weekStart?: string;
  deferredUntil?: string;
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
  setScores?: SetScore[];
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
  vacation?: boolean;
  playerId: string;
  from: string;
  to: string;
  note: string;
}
export interface Message extends Entity {
  mentions?: import("./chat-mentions").ChatMention[];
  audienceIds?: string[];
  challengeId: string;
  playerId: string;
  text: string;
  createdAt: string;
}
export interface Notification extends Entity {
  chatMessageId?: string;
  weeklyChallengeOpening?: {
    weekStart: string;
    opensAt: string;
    divisionId?: string;
  };
  responseDeadline?: {
    id: string;
    managed: boolean;
    respondBy: string;
    status: "pending" | "expired";
  };
  kind?: NotificationEvent;
  seasonId?: string;
  rankingNotice?: boolean;
  deliveryChannels?: ("email" | "whatsapp" | "push")[];
  competitionNotice?: boolean;
  adminTestId?: string;
  testChannels?: TestChannel[];
  playerId: string;
  title: string;
  body: string;
  challengeId?: string;
  read: boolean;
  createdAt: string;
  dedupe?: string;
}
export interface History extends Entity {
  oldTeamPosition?: number;
  newTeamPosition?: number;
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
  approvedBy?: string;
  championsBefore?: Champion[];
  championsAfter?: Champion[];
  challengeId: string;
  winnerId: string;
  loserId: string;
  score: string;
  setScores?: SetScore[];
  confirmedAt: string;
  seasonId: string;
}
export interface Champion extends Entity {
  teamId?: string;
  teamSnapshot?: { playerId: string; name: string }[];
  divisionId: string;
  playerId: string;
  since: string;
  until?: string;
  defenses: number;
  seasonId: string;
}
export interface Season extends Entity {
  firstCompetitionWeek?: string;
  divisionRankingPublications?: {
    divisionId: string;
    weekStart: string;
    publishedAt: string;
    publishedBy: string;
    resultSignature: string;
  }[];
  weeklyRankingPublication?: {
    weekStart: string;
    publishedAt: string;
    publishedBy: string;
  };
  startAnnouncedAt?: string;
  startAnnouncedBy?: string;
  version?: number;
  archivedDivisions?: Division[];
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
export interface WeeklyRound extends Entity {
  divisionTransitions?: Record<
    string,
    { previousWeek: string; preparedAt: string }
  >;
  divisionPublications?: Record<
    string,
    {
      approvedAt?: string;
      approvedBy?: string;
      approvalSnapshot?: string;
      publishedAt?: string;
      publishedBy?: string;
    }
  >;
  divisionRoleGeneration?: Record<
    string,
    { input: string; assignments: string }
  >;
  divisionOpeningDelays?: Record<string, number>;
  dynamicAssignments?: { playerId: string; role: "attack" | "defense" }[];
  challengesOpenAt?: string;
  /** null holds this division until an administrator opens it. */
  divisionChallengeOpenings?: Record<string, string | null>;
  openingNotifiedAt?: string;
  teamSnapshot?: {
    id: string;
    name: string;
    divisionId: string;
    playerIds: string[];
  }[];
  version?: number;
  seasonId?: string;
  weekType?: "NORMAL" | "OPEN_ATTACK";
  generatedAt?: string;
  generatedBy?: string;
  approvedAt?: string;
  approvedBy?: string;
  approvedVersion?: number;
  approvalSnapshot?: string;
  publishedBy?: string;
  warnings?: string[];
  weekStart: string;
  publishedAt?: string;
  assignments: { playerId: string; role: "attack" | "defense" }[];
}
export interface State {
  clubPhotos?: ClubPhoto[];
  clubPhotoUnlocks?: ClubPhotoUnlock[];
  matchVotingSettings?: MatchVotingSettings[];
  /** Server-derived anonymous aggregates; never persisted. */
  matchVoteSummaries?: MatchVoteSummary[];
  matchVotes?: MatchVote[];
  matchDiscussionMessages?: MatchDiscussionMessage[];
  /** Verified administrator contacts, derived by the server; never a persisted collection. */
  chatAdministrators?: { playerId: string; name: string }[];
  /** Server-derived verified admin roster; never persisted as a collection. */
  adminTestAccounts?: AdminTestAccount[];
  adminTestChallenges?: AdminTestChallenge[];
  placementEvents?: PlacementEvent[];
  gamificationSettings?: GamificationSettings[];
  gamificationProfiles?: GamificationProfile[];
  sponsors?: Sponsor[];
  coinSettings?: CoinSettings[];
  coinEntries?: CoinEntry[];
  stickerSettings?: StickerSettings[];
  stickerPacks?: StickerPack[];
  stickerRewards?: StickerReward[];
  adminNotes?: AdminNote[];
  playerAttributes?: PlayerAttributes[];
  engagementSettings?: EngagementSettings[];
  predictions?: Prediction[];
  competitionConfigurations?: CompetitionConfiguration[];
  competitionRounds?: CompetitionRound[];
  competitionSchedules?: CompetitionSchedule[];
  competitionAbsences?: CompetitionAbsence[];
  competitionRecoveries?: CompetitionRecovery[];
  competitionChallenges?: CompetitionChallenge[];
  weeklyRounds: WeeklyRound[];
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
  "clubPhotos",
  "clubPhotoUnlocks",
  "matchVotingSettings",
  "matchVotes",
  "matchDiscussionMessages",
  "adminTestChallenges",
  "placementEvents",
  "gamificationSettings",
  "gamificationProfiles",
  "sponsors",
  "coinSettings",
  "coinEntries",
  "stickerSettings",
  "stickerPacks",
  "stickerRewards",
  "adminNotes",
  "playerAttributes",
  "engagementSettings",
  "predictions",
  "competitionConfigurations",
  "competitionRounds",
  "competitionSchedules",
  "competitionAbsences",
  "competitionRecoveries",
  "competitionChallenges",
  "weeklyRounds",
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
export type Workspace = "admin" | "player";
export interface Actor {
  accountRole?: Workspace;
  workspace?: Workspace;
  workspaceSelectionRequired?: boolean;
  /** Internal server-only session identity; never serialized. */
  sessionId?: string;
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
  workspace?: Workspace;
  userId: string;
  expiresAt: Date;
}
export interface View extends State {
  actor: Actor;
  demo: boolean;
}

export const defaultSettings: Settings = {
  weeklyCompetition: false,
  weeklyMandatoryChallenges: false,
  weeklyDynamicRoles: false,
  divisionChallengeDistances: {},
  autoWeeklyRoles: true,
  roleDraftLeadDays: 7,
  autoWeeklyRanking: true,
  weeklyRankingDay: 0,
  weeklyRankingHour: 20,
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
