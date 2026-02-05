import * as core from "@actions/core";
import { ActionInputs } from "./types";

const ONE_HOUR_SECONDS = 60 * 60;

export function getInputs(): ActionInputs {
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
