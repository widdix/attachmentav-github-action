import { Readable } from "stream";
import type { AttachmentAVSyncResponse } from "./types";

const ATTACHMENTAV_SYNC_URL =
  "https://api.attachmentav.com/v1/scan/sync/binary";

export async function scanFileSync(
  buffer: Buffer,
  apiKey: string
): Promise<AttachmentAVSyncResponse> {
  const stream = Readable.from(buffer);

  const response = await fetch(ATTACHMENTAV_SYNC_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/octet-stream",
      "Content-Length": buffer.length.toString(),
    },
    body: stream as any,
    duplex: "half",
  } as RequestInit);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `AttachmentAV API error: ${response.status} ${response.statusText}. ${errorText}`
    );
  }

  const result = (await response.json()) as AttachmentAVSyncResponse;
  return result;
}
