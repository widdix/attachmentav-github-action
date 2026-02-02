import * as core from "@actions/core";
import type { AttachmentAVSyncResponse } from "./types";

const ATTACHMENTAV_SYNC_URL =
  "https://api.attachmentav.com/v1/scan/sync/binary";

export async function scanFileSync(
  buffer: Buffer,
  apiKey: string
): Promise<AttachmentAVSyncResponse> {
  core.debug(`Making request to: ${ATTACHMENTAV_SYNC_URL}`);
  core.debug(`Buffer size: ${buffer.length} bytes`);
  core.debug(`API key length: ${apiKey.length} characters`);

  try {
    // Use buffer directly instead of stream for better compatibility
    const response = await fetch(ATTACHMENTAV_SYNC_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/octet-stream",
        "Content-Length": buffer.length.toString(),
      },
      body: buffer,
    });

    core.debug(`Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      core.error(`API error response: ${errorText}`);
      throw new Error(
        `AttachmentAV API error: ${response.status} ${response.statusText}. ${errorText}`
      );
    }

    const result = (await response.json()) as AttachmentAVSyncResponse;
    core.debug(`Scan result: ${JSON.stringify(result)}`);
    return result;
  } catch (error) {
    core.error(`Fetch error details: ${error}`);
    if (error instanceof Error) {
      core.error(`Error message: ${error.message}`);
      core.error(`Error stack: ${error.stack}`);
    }
    throw error;
  }
}
