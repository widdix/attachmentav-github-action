export interface AttachmentAVResponse {
  status: "clean" | "infected" | "no";
  finding?: string;
  size?: number;
  realfiletype?: string;
}

export interface AttachmentAVAsyncRequest {
  download_url: string;
  download_headers?: Record<string, string>;
  trace_id: string;
}

export interface AttachmentAVSyncDownloadRequest {
  download_url: string;
  download_headers?: Record<string, string>;
}

export interface GitHubReleaseAsset {
  id: number;
  name: string;
  size: number;
  url: string;
  browser_download_url: string;
}

export interface GitHubArtifact {
  id: number;
  name: string;
  size_in_bytes: number;
  archive_download_url: string;
}

export interface ActionInputs {
  localFilePath?: string;
  artifactId?: string;
  releaseAssetId?: string;
  apiEndpoint: string;
  apiKey: string;
  token?: string;
  timeout: number;
  pollingInterval: number;
  failOnInfected: boolean;
}