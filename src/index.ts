import * as core from "@actions/core";
import { pollAsyncResult, scanFileSync, scanFileSyncDownload, submitAsyncScan, } from "./api";
import { readFileAndCheckSize } from "./fileUtils";
import { getActualDownloadUrl, getArtifact, getReleaseAsset, } from "./github";
import { getInputs } from "./inputs";
import { AttachmentAVResponse } from "./types";
import { generateTraceId } from "./utils";

const MB = 1024 * 1024;
const SYNC_DOWNLOAD_THRESHOLD = 200 * MB;

async function handleLocalFilePath(apiEndpoint: string, apiKey: string, localFilePath: string): Promise<AttachmentAVResponse> {
  core.info(`Scanning local file: ${localFilePath}`);
  core.debug(`Working directory: ${process.cwd()}`);

  const { buffer, size } = await readFileAndCheckSize(localFilePath);
  core.info(`File size: ${size} bytes`);

  const MAX_SYNC_SIZE = 10 * MB;

  if (size <= MAX_SYNC_SIZE) {
    // Use sync API
    core.info("Using sync API (file ≤10MB)");
    return scanFileSync(apiEndpoint, apiKey, buffer);
  } else {
    // Use async API - need to provide download URL
    throw new Error(
      "Local files >10MB require async API, but local files cannot be directly accessed by attachmentAV. Please upload the file as a release asset or artifact first."
    );
  }
}

interface AsyncOptions {
  timeout: number;
  pollingInterval: number;
  token?: string;
}

async function submitAndPollAsyncScan(apiEndpoint: string, apiKey: string, downloadUrl: string, options: AsyncOptions) {
  const { timeout, pollingInterval, token } = options;
  const traceId = generateTraceId();
  core.info(`Generated trace ID: ${traceId}`);

  const downloadHeaders: Record<string, string> = {};
  if (token) {
    downloadHeaders.Authorization = `Bearer ${token}`;
  }

  await submitAsyncScan(
    apiEndpoint,
    apiKey,
    {
      download_url: downloadUrl,
      download_headers: Object.keys(downloadHeaders).length > 0 ? downloadHeaders : undefined,
      trace_id: traceId,
    },
  );

  return pollAsyncResult(
    apiEndpoint,
    apiKey,
    traceId,
    timeout,
    pollingInterval
  );
}

async function handleArtifact(
  apiEndpoint: string,
  apiKey: string,
  artifactId: string,
  options: AsyncOptions
): Promise<AttachmentAVResponse> {
  const id = parseInt(artifactId, 10);
  core.info(`Scanning artifact ID: ${id}`);

  if (!options.token) {
    throw new Error("GitHub token is required for scanning artifacts");
  }

  const artifact = await getArtifact(id, options.token);
  core.info(
    `Artifact: ${artifact.name}, size: ${artifact.size_in_bytes} bytes`
  );

  // Get the actual download URL (valid for 1 minute)
  const actualDownloadUrl = await getActualDownloadUrl(
    'artifact',
    artifact.archive_download_url,
    options.token,
  );

  if (artifact.size_in_bytes < SYNC_DOWNLOAD_THRESHOLD) {
    // Use sync download API for files < 200MB
    core.info("Using sync download API (artifact < 200MB)");
    return scanFileSyncDownload(apiEndpoint, apiKey, {
      download_url: actualDownloadUrl,
    });
  } else {
    // Use async API for files >= 200MB
    core.info("Using async API (artifact ≥ 200MB)");
    return submitAndPollAsyncScan(
      apiEndpoint,
      apiKey,
      actualDownloadUrl,
      options
    );
  }
}

async function handleReleaseAsset(
  apiEndpoint: string,
  apiKey: string,
  releaseAssetId: string,
  options: AsyncOptions
): Promise<AttachmentAVResponse> {
  const id = parseInt(releaseAssetId, 10);
  core.info(`Scanning release asset ID: ${id}`);

  const asset = await getReleaseAsset(id, options.token);
  core.info(`Release asset: ${asset.name}, size: ${asset.size} bytes`);

  // Get the actual download URL (valid for 1 hour)
  const actualDownloadUrl = await getActualDownloadUrl(
    'release-asset',
    asset.url,
    options.token,
  );

  if (asset.size < SYNC_DOWNLOAD_THRESHOLD) {
    // Use sync download API for files < 200MB
    core.info("Using sync download API (asset < 200MB)");
    return scanFileSyncDownload(apiEndpoint, apiKey, {
      download_url: actualDownloadUrl,
    });
  } else {
    // Use async API for files >= 200MB
    core.info("Using async API (asset ≥ 200MB)");
    return submitAndPollAsyncScan(
      apiEndpoint,
      apiKey,
      actualDownloadUrl,
      options
    );
  }
}

async function run(): Promise<void> {
  core.info("Starting attachmentAV malware scan...");

  let inputs;
  try {
    inputs = getInputs();
  } catch (error) {
    core.setFailed((error as Error).message);
    return;
  }

  const {
    localFilePath,
    artifactId,
    releaseAssetId,
    apiEndpoint,
    apiKey,
    token,
    timeout,
    pollingInterval,
    failOnInfected
  } = inputs;

  let result: AttachmentAVResponse;

  try {
    if (localFilePath) {
      result = await handleLocalFilePath(apiEndpoint, apiKey, localFilePath);
    } else if (artifactId) {
      result = await handleArtifact(apiEndpoint, apiKey, artifactId, { token, timeout, pollingInterval });
    } else if (releaseAssetId) {
      result = await handleReleaseAsset(apiEndpoint, apiKey, releaseAssetId, { token, timeout, pollingInterval });
    } else {
      core.setFailed("Unexpected error: no scan target provided");
      return;
    }
  } catch (error) {
    core.setFailed((error as Error).message);
    return;
  }

  // Set outputs
  core.setOutput("status", result.status);
  core.setOutput("file-size", result.size.toString());

  if (result.finding) {
    core.setOutput("finding", result.finding);
  }

  if (result.realfiletype) {
    core.setOutput("real-file-type", result.realfiletype);
  }

  // Log results
  core.info(`Scan status: ${result.status}`);
  if (result.finding) {
    core.warning(`Malware detected: ${result.finding}`);
  }
  if (result.realfiletype) {
    core.info(`Detected file type: ${result.realfiletype}`);
  }

  // Fail if infected and failOnInfected is true
  if (result.status === "infected" && failOnInfected) {
    core.setFailed(
      `Malware detected in file: ${result.finding || "Unknown threat"}`
    );
  } else if (result.status === "infected") {
    core.warning(
      `Malware detected but action not failed (fail-on-infected is false)`
    );
  } else if (result.status === "clean") {
    core.info("✓ File is clean - no malware detected");
  } else if (result.status === "no") {
    core.info(`File could not be scanned (${result.finding || 'unknown reason'})`);
  }
}

run();
