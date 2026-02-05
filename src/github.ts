import * as core from "@actions/core";
import * as github from "@actions/github";
import type { GitHubReleaseAsset, GitHubArtifact } from "./types";

/**
 * Get the actual download URL by calling the GitHub URL without following redirects.
 * The Location header contains the actual download URL.
 * For artifacts: valid for 1 minute
 * For release assets: valid for 1 hour
 */
export async function getActualDownloadUrl(
  url: string,
  token?: string
): Promise<string> {
  core.debug(`Getting actual download URL from: ${url}`);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        Accept: "application/octet-stream",
      },
      redirect: "manual", // Don't follow redirects
    });

    // For redirects (301, 302, 303, 307, 308), get Location header
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("Location");
      if (!location) {
        throw new Error(
          `Expected Location header in redirect response, but got none`
        );
      }
      core.debug(`Actual download URL retrieved (valid for limited time)`);
      return location;
    }

    throw new Error(
      `Expected redirect response, but got ${response.status} ${response.statusText}`
    );
  } catch (error) {
    core.error(`Failed to get actual download URL: ${error}`);
    throw error;
  }
}

export async function getReleaseAsset(
  assetId: number,
  token?: string
): Promise<GitHubReleaseAsset> {
  const { owner, repo } = github.context.repo;
  core.debug(`Fetching release asset ${assetId} from ${owner}/${repo}`);

  const octokit = github.getOctokit(token || process.env.GITHUB_TOKEN || "");

  try {
    const { data } = await octokit.request('GET /repos/{owner}/{repo}/releases/assets/{asset_id}', {
      owner,
      repo,
      asset_id: assetId,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28'
      },
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
    const { data } = await octokit.request('GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}', {
      owner,
      repo,
      artifact_id: artifactId,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28'
      },
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
