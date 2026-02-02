export interface AttachmentAVSyncResponse {
  status: "clean" | "infected" | "no";
  finding?: string;
  size: number;
  realfiletype?: string;
}
