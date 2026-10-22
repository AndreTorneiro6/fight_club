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
export interface CompetitionChallenge {
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
