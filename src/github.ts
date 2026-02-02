import * as core from "@actions/core";
import * as github from "@actions/github";
import type { GitHubReleaseAsset, GitHubArtifact } from "./types";

export async function getReleaseAsset(
  assetId: number,
  token?: string
): Promise<GitHubReleaseAsset> {
  const { owner, repo } = github.context.repo;
  core.debug(`Fetching release asset ${assetId} from ${owner}/${repo}`);

  const octokit = github.getOctokit(token || process.env.GITHUB_TOKEN || "");

  try {
    const { data } = await octokit.rest.repos.getReleaseAsset({
      owner,
      repo,
      asset_id: assetId,
    });

    core.debug(`Release asset: ${data.name}, size: ${data.size} bytes`);

    return {
      id: data.id,
      name: data.name,
      size: data.size,
      url: data.url,
      browser_download_url: data.browser_download_url,
    };
  } catch (error) {
    core.error(`Failed to fetch release asset: ${error}`);
    throw error;
  }
}

export async function getArtifact(
  artifactId: number,
  token?: string
): Promise<GitHubArtifact> {
  const { owner, repo } = github.context.repo;
  core.debug(`Fetching artifact ${artifactId} from ${owner}/${repo}`);

  const octokit = github.getOctokit(token || process.env.GITHUB_TOKEN || "");

  try {
    const { data } = await octokit.rest.actions.getArtifact({
      owner,
      repo,
      artifact_id: artifactId,
    });

    core.debug(
      `Artifact: ${data.name}, size: ${data.size_in_bytes} bytes`
    );

    return {
      id: data.id,
      name: data.name,
      size_in_bytes: data.size_in_bytes,
      archive_download_url: data.archive_download_url,
    };
  } catch (error) {
    core.error(`Failed to fetch artifact: ${error}`);
    throw error;
  }
}
