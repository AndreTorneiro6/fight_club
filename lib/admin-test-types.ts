export type TestChannel = "push" | "email" | "whatsapp";
export interface AdminTestAccount {
  playerId: string;
  name: string;
}
export interface AdminTestChallenge {
  _id: string;
  requestId: string;
  attackerId: string;
  defenderId: string;
  note: string;
  channels: TestChannel[];
  status:
    | "PENDING"
    | "ACCEPTED"
    | "DECLINED"
    | "CANCELLED"
    | "SCHEDULE_PROPOSED"
    | "SCHEDULED"
    | "RESULT_PENDING"
    | "COMPLETED";
  version: number;
  start?: string;
  proposedBy?: string;
  winnerId?: string;
  score?: string;
  reportedBy?: string;
  createdAt: string;
  updatedAt: string;
}
