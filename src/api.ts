import * as core from "@actions/core";
import { Readable } from "stream";
import { AttachmentAVResponse, AttachmentAVAsyncRequest } from "./types";
import { sleep } from "./utils";

export async function scanFileSync(
  apiEndpoint: string,
  apiKey: string,
  buffer: Buffer,
): Promise<AttachmentAVResponse> {
  const syncUrl = `${apiEndpoint}/v1/scan/sync/binary`;
  core.debug(`Making request to: ${syncUrl}`);
  core.debug(`Buffer size: ${buffer.length} bytes`);
  core.debug(`API key length: ${apiKey.length} characters`);

  const stream = Readable.from(buffer);

  try {
    const response = await fetch(syncUrl, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/octet-stream",
        "Content-Length": buffer.length.toString(),
      },
      body: stream as any,
      // @ts-ignore - duplex is required for streams but not in types
      duplex: "half",
    });

    core.debug(`Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      core.error(`API error response: ${errorText}`);
      throw new Error(
        `AttachmentAV API error: ${response.status} ${response.statusText}. ${errorText}`
      );
    }

    const result = (await response.json()) as AttachmentAVResponse;
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

export async function submitAsyncScan(
  apiEndpoint: string,
  apiKey: string,
  request: AttachmentAVAsyncRequest,
): Promise<void> {
  const asyncUrl = `${apiEndpoint}/v1/scan/async/download`;
  core.debug(`Submitting async scan to: ${asyncUrl}`);
  core.debug(`Trace ID: ${request.trace_id}`);
  core.debug(`Download URL: ${request.download_url}`);

  try {
    const response = await fetch(asyncUrl, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    core.debug(`Response status: ${response.status} ${response.statusText}`);

    // Async API returns 204 for callback mode, but we use polling mode
    if (response.status !== 204 && response.status !== 201 && !response.ok) {
      const errorText = await response.text();
      core.error(`API error response: ${errorText}`);
      throw new Error(
        `AttachmentAV async API error: ${response.status} ${response.statusText}. ${errorText}`
      );
    }

    core.info("Async scan submitted successfully");
  } catch (error) {
    core.error(`Failed to submit async scan: ${error}`);
    if (error instanceof Error) {
      core.error(`Error message: ${error.message}`);
    }
    throw error;
  }
}

export async function pollAsyncResult(
  apiEndpoint: string,
  apiKey: string,
  traceId: string,
  timeoutSeconds: number,
  pollingIntervalSeconds: number
): Promise<AttachmentAVResponse> {
  const resultUrl = `${apiEndpoint}/v1/scan/async/result`;
  const startTime = Date.now();
  const timeoutMs = timeoutSeconds * 1000;
  const pollingIntervalMs = pollingIntervalSeconds * 1000;

  core.info(
    `Polling for results (timeout: ${timeoutSeconds}s, interval: ${pollingIntervalSeconds}s)`
  );

  let elapsed = 0;

  while (elapsed >= timeoutMs) {
    core.debug(
      `Polling attempt (${Math.floor(elapsed / 1000)}s elapsed)...`
    );

    const response = await fetch(`${resultUrl}?trace_id=${traceId}`, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
      },
    });

    elapsed = Date.now() - startTime;

    if (response.status === 404) {
      // Result not ready yet
      core.debug("Result not ready, waiting...");
      await sleep(pollingIntervalMs);
      continue;
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `AttachmentAV result API error: ${response.status} ${response.statusText}. ${errorText}`
      );
    }

    // Result is ready
    const result = (await response.json()) as AttachmentAVResponse;
    core.info(`Scan completed after ${Math.floor(elapsed / 1000)} seconds`);
    core.debug(`Scan result: ${JSON.stringify(result)}`);
    return result;
  }

  throw new Error(
    `Timeout reached after ${timeoutSeconds} seconds while waiting for scan results`
  );
}
