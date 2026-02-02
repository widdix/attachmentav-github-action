import * as core from "@actions/core";
import { pollAsyncResult, scanFileSync, submitAsyncScan } from "./api";
import { readFileAndCheckSize } from "./fileUtils";
import { getArtifact, getReleaseAsset } from "./github";
import { ActionInputs, AttachmentAVResponse } from "./types";
import { generateTraceId } from "./utils";

const ONE_HOUR_SECONDS = 60 * 60;

function getInputs(): ActionInputs {
  const localFilePath = core.getInput("local-file-path");
  const artifactId = core.getInput("artifact-id");
  const releaseAssetId = core.getInput("release-asset-id");
  const apiEndpoint = core.getInput("api-endpoint", { required: true });
  const apiKey = core.getInput("api-key", { required: true });
  const token = core.getInput("token");
  const timeout = parseInt(core.getInput("timeout", { required: true }), 10);
  const pollingInterval = parseInt(
    core.getInput("polling-interval", { required: true }),
    10
  );
  const failOnInfected = core.getBooleanInput("fail-on-infected");

  // Validate mutually exclusive inputs
  const inputCount = [localFilePath, artifactId, releaseAssetId].filter(
    (input) => input
  ).length;

  if (inputCount === 0) {
    throw new Error(
      "One of local-file-path, artifact-id, or release-asset-id must be provided"
    );
  }

  if (inputCount > 1) {
    throw new Error(
      "Only one of local-file-path, artifact-id, or release-asset-id can be provided"
    );
  }

  // Validate ranges for number inputs

  if (timeout > ONE_HOUR_SECONDS || timeout < 1) {
    throw new Error(`timeout out of range. Max ${ONE_HOUR_SECONDS} seconds, min 1 second.`);
  }

  if (pollingInterval > ONE_HOUR_SECONDS || pollingInterval < 1) {
    throw new Error(`polling-interval out of range. Max ${ONE_HOUR_SECONDS} seconds, min 1 second.`);
  }

  return {
    localFilePath,
    artifactId,
    releaseAssetId,
    apiEndpoint,
    apiKey,
    token,
    timeout,
    pollingInterval,
    failOnInfected
  };
}

async function handleLocalFilePath(apiEndpoint: string, apiKey: string, localFilePath: string): Promise<AttachmentAVResponse> {
  core.info(`Scanning local file: ${localFilePath}`);
  core.debug(`Working directory: ${process.cwd()}`);

  const { buffer, size } = await readFileAndCheckSize(localFilePath);
  core.info(`File size: ${size} bytes`);

  const MB = 1024 * 1024;
  const MAX_SYNC_SIZE = 10 * MB;

  if (size <= MAX_SYNC_SIZE) {
    // Use sync API
    core.info("Using sync API (file ≤10MB)");
    return scanFileSync(apiKey, apiEndpoint, buffer);
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

async function handleArtifact(apiEndpoint: string, apiKey: string, artifactId: string, options: AsyncOptions) {
  const id = parseInt(artifactId, 10);
  core.info(`Scanning artifact ID: ${id}`);

  const artifact = await getArtifact(id, options.token);
  core.info(`Artifact: ${artifact.name}, size: ${artifact.size_in_bytes} bytes`);
  const downloadUrl = artifact.archive_download_url;

  return submitAndPollAsyncScan(apiEndpoint, apiKey, downloadUrl, options);
}

async function handleReleaseAsset(apiEndpoint: string, apiKey: string, releaseAssetId: string, options: AsyncOptions) {
  const id = parseInt(releaseAssetId, 10);
  core.info(`Scanning release asset ID: ${id}`);

  const asset = await getReleaseAsset(id, options.token);
  core.info(`Release asset: ${asset.name}, size: ${asset.size} bytes`);
  const downloadUrl = asset.url;

  return submitAndPollAsyncScan(apiEndpoint, apiKey, downloadUrl, options);
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
