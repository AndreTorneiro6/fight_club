export type WeekType = "NORMAL" | "OPEN_ATTACK";
export interface CompetitionWeights {
  consecutive: number;
  recent: number;
  frequency: number;
  role: number;
  priority: number;
}
export interface CompetitionConfiguration {
  _id: string;
  seasonId: string;
  enabled: boolean;
  officialRounds: number;
  defaultDistance: number;
  leagueDistances: Record<string, number>;
  championPositions: number[];
  responseHours: number;
  recoveryRequiresAbsence?: boolean;
  roleWarningThreshold?: number;
  opponentWarningThreshold?: number;
  leagueOverrides?: Record<
    string,
    {
      championPositions?: number[];
      weights?: CompetitionWeights;
      responseHours?: number;
      recoveryRequiresAbsence?: boolean;
      roleWarningThreshold?: number;
      opponentWarningThreshold?: number;
    }
  >;
  firstOpen: boolean;
  finalOpen: boolean;
  weights: CompetitionWeights;
  version: number;
  updatedAt: string;
}
export interface CompetitionTeam {
  id: string;
  members: { playerId: string; name: string }[];
  rank: number;
  active: boolean;
}
export interface CompetitionRound {
  _id: string;
  competitionId: string;
  divisionId: string;
  number: number;
  weekType?: WeekType;
  distanceOverride?: number;
  opensAt: string;
  closesAt: string;
  schedulingDeadline: string;
  startsAt: string;
  endsAt: string;
  instructions: string;
  locked: boolean;
  /** Server-derived, filtered eligibility; never trusted in commands. */
  challengeTargets?: Record<string, string[]>;
  challengePendingCounts?: Record<string, number>;
  roles?: Record<string, "attack" | "defense">;
  rolesGeneratedAt?: string;
  rolesGeneratedBy?: string;
  rolesWarnings?: string[];
  rolesApprovedAt?: string;
  rolesApprovedBy?: string;
  rolesApprovedVersion?: number;
  rolesApprovalSnapshot?: string;
  rolesPublishedAt?: string;
  rolesPublishedBy?: string;
  roleSnapshot?: CompetitionTeam[];
  challengesBlocked?: boolean;
  settledAt?: string;
  rankingBefore?: CompetitionTeam[];
  rankingAfter?: CompetitionTeam[];
  version: number;
}
export interface CompetitionPair {
  attackerId: string;
  defenderId: string;
  locked?: boolean;
  start?: string;
  courtId?: string;
  recoveryId?: string;
  reason?: string;
  warnings?: string[];
  challengeId?: string;
}
export interface CompetitionSchedule {
  /** Incremental, explicitly approved individual match publication. */
  incremental?: boolean;
  supersededBy?: string;
  _id: string;
  roundId: string;
  version: number;
  revision: number;
  status: "DRAFT" | "APPROVED" | "PUBLISHED";
  snapshot: CompetitionTeam[];
  effectiveDistance: number;
  matchMinutes?: number;
  championPositions: number[];
  weekType: WeekType;
  pairs: CompetitionPair[];
  unmatched: string[];
  warnings: string[];
  errors: string[];
  createdAt: string;
  createdBy: string;
  approvedAt?: string;
  approvedBy?: string;
  approvedVersion?: number;
  publishedAt?: string;
  publishedBy?: string;
  amendmentOf?: string;
  reason?: string;
}
export interface CompetitionAbsence {
  _id: string;
  competitionId: string;
  divisionId: string;
  teamId: string;
  from: string;
  to: string;
  reason: string;
  roundIds: string[];
  approvedBy: string;
  approvedAt: string;
  recoveryAllowed: boolean;
}
export interface CompetitionRecovery {
  _id: string;
  roundId: string;
  sourceRoundId: string;
  teamIds: string[];
  reason: string;
  approvedBy: string;
  approvedAt: string;
}
export interface ChallengeTimeProposal {
  id: string;
  version: number;
  start: string;
  minutes: number;
  courtId?: string;
  proposedByTeamId: string;
  attackerConfirmed: boolean;
  defenderConfirmed: boolean;
  status: "PENDING_TEAMS" | "AWAITING_ADMIN" | "APPROVED" | "REJECTED";
  decidedAt?: string;
  decidedBy?: string;
  reason?: string;
}
export interface CompetitionChallenge {
  timeVersion?: number;
  timeProposal?: ChallengeTimeProposal;
  _id: string;
  roundId: string;
  attackerId: string;
  defenderId: string;
  attackerRank: number;
  defenderRank: number;
  effectiveDistance: number;
  submissionOrder?: number;
  createdAt: string;
  respondBy: string;
  status:
    | "PENDING"
    | "ACCEPTED"
    | "REJECTED"
    | "EXPIRED"
    | "SCHEDULED"
    | "COMPLETED"
    | "CANCELLED";
  priorityEligible?: boolean;
  responseNote?: string;
  invalidReason?: string;
  priorityWinner?: boolean;
  priorityReason?: string;
  decisions: { at: string; actorId: string; action: string }[];
}
export interface CompetitionMeeting {
  round: number;
  attackerId: string;
  defenderId: string;
  winnerId?: string;
  completedAt?: string;
}
export const competitionCollections = [
  "competitionConfigurations",
  "competitionRounds",
  "competitionSchedules",
  "competitionAbsences",
  "competitionRecoveries",
  "competitionChallenges",
] as const;
export const defaultCompetitionWeights: CompetitionWeights = {
  consecutive: 10000,
  recent: 1000,
  frequency: 100,
  role: 20,
  priority: 100000,
};
