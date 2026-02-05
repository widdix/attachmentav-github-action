# attachmentAV Malware Scanner

A GitHub Action that scans files for malware and viruses using the [attachmentAV API](https://attachmentav.com).
Supports scanning local repository files, GitHub Actions artifacts, and GitHub release assets.

## Features

- **Local File Scanning**: Scan files directly from your repository (up to 100MB)
- **Artifact Scanning**: Scan GitHub Actions artifacts with automatic size-based API selection
- **Release Asset Scanning**: Scan files attached to GitHub releases
- **Flexible Configuration**: Configurable timeout, polling intervals, and failure behavior
- **Detailed Outputs**: Get scan status, malware findings, file size, and detected file type

## Prerequisites

1. **attachmentAV API Key**: Sign up at [attachmentAV](https://attachmentav.com) to get an API key
2. **GitHub Token**: Required for downloading artifacts or releases of private repositories; can be
   a [personal access token (PAT)](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)
   or the [GitHub Actions token](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token)

## Usage

### Scan Local Repository Files

Scan files directly from your repository. Supports files up to 100MB.

```yaml
- name: Scan local file
  uses: attachmentAV/scan@v1
  with:
    local-file-path: path/to/file.zip
    api-key: ${{ secrets.ATTACHMENTAV_API_KEY }}
```

For files larger than 10MB, a GitHub token is required:

```yaml
- name: Scan large local file
  uses: attachmentAV/scan@v1
  with:
    local-file-path: path/to/large-file.zip
    api-key: ${{ secrets.ATTACHMENTAV_API_KEY }}
    token: ${{ github.token }}
```

**Required Permissions:**

```yaml
permissions:
  contents: read
```

**Limitations:**
- Files ≤10MB: Uploaded directly (no token required)
- Files >10MB and ≤100MB: Downloaded via GitHub Contents API (token required)
- Files >100MB: Not supported for local scanning; upload as release asset or artifact first

### Scan GitHub Actions Artifacts

Scan artifacts, usually created by [`actions/upload-artifact`](https://github.com/actions/upload-artifact). The action
automatically selects the appropriate malware scanning API based on artifact size (sync API for <200MB, async API for
≥200MB).

```yaml
- name: Upload artifact
  id: upload
  uses: actions/upload-artifact@v6
  with:
    name: my-artifact
    path: dist/

- name: Scan artifact
  uses: attachmentAV/scan@v1
  with:
    artifact-id: ${{ steps.upload.outputs.artifact-id }}
    api-key: ${{ secrets.ATTACHMENTAV_API_KEY }}
    token: ${{ github.token }}
```

**Required Permissions:**

```yaml
permissions:
  actions: read
  contents: read
```

**Note:** The `token` input is **required** for artifact scanning as artifacts always require authentication.

### Scan GitHub Release Assets

Scan files attached to GitHub releases. The action automatically selects the appropriate scanning method based on asset
size (sync API for <200MB, async API for ≥200MB).

```yaml
- name: Scan release asset
  uses: attachmentAV/scan@v1
  with:
    release-asset-id: ${{ steps.get_asset.outputs.asset_id }}
    api-key: ${{ secrets.ATTACHMENTAV_API_KEY }}
    token: ${{ github.token }}  # Optional for public repos, but recommended to provide
```

**Required Permissions:**

```yaml
permissions:
  contents: read
```

**Note:** The `token` input is optional for public repositories but recommended to avoid rate limiting and ensure
reliable access.

## Inputs

| Input              | Description                                          | Required | Default                                 |
|--------------------|------------------------------------------------------|----------|-----------------------------------------|
| `local-file-path`  | Path to local file in repository to scan             | No*      | -                                       |
| `artifact-id`      | GitHub Actions artifact ID to scan                   | No*      | -                                       |
| `release-asset-id` | GitHub release asset ID to scan                      | No*      | -                                       |
| `api-key`          | attachmentAV API key                                 | **Yes**  | -                                       |
| `token`            | GitHub token for private resources                   | No**     | -                                       |
| `api-endpoint`     | attachmentAV API endpoint                            | No       | `https://eu.developer.attachmentav.com` |
| `timeout`          | Timeout in seconds for async scans (1-3600)          | No       | `300`                                   |
| `polling-interval` | Polling interval in seconds for async scans (1-3600) | No       | `5`                                     |
| `fail-on-infected` | Fail the action if malware is detected               | No       | `true`                                  |

\* **One of** `local-file-path`, `artifact-id`, or `release-asset-id` must be provided (mutually exclusive)
\*\* Required for: artifacts, local files >10MB and release assets of private repositories

## Outputs

| Output           | Description                                           |
|------------------|-------------------------------------------------------|
| `status`         | Scan result: `clean`, `infected`, or `no`             |
| `finding`        | Malware type if infected (e.g., "Win.Trojan.Generic") |
| `file-size`      | Size of scanned file in bytes                         |
| `real-file-type` | Detected file type (e.g., "application/zip")          |

## Example: Complete Workflow

```yaml
name: Security Scan

on:
  push:
    branches: [ main ]
  release:
    types: [ published ]

permissions:
  actions: read    # Required for artifact scanning
  contents: read   # Required for all scan types

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v6

      # Example 1: Scan a local file
      - name: Scan build artifact
        id: scan_local
        uses: attachmentAV/scan@v1
        with:
          local-file-path: dist/app.zip
          api-key: ${{ secrets.ATTACHMENTAV_API_KEY }}
          fail-on-infected: true

      # Example 2: Upload and scan artifact
      - name: Upload artifact
        id: upload
        uses: actions/upload-artifact@v6
        with:
          name: build-output
          path: dist/

      - name: Scan artifact
        id: scan_artifact
        uses: attachmentAV/scan@v1
        with:
          artifact-id: ${{ steps.upload.outputs.artifact-id }}
          api-key: ${{ secrets.ATTACHMENTAV_API_KEY }}
          token: ${{ github.token }}

      # Example 3: Display results
      - name: Display scan results
        run: |
          echo "Status: ${{ steps.scan_artifact.outputs.status }}"
          echo "File size: ${{ steps.scan_artifact.outputs.file-size }} bytes"
          if [ "${{ steps.scan_artifact.outputs.status }}" = "infected" ]; then
            echo "⚠️ Malware found: ${{ steps.scan_artifact.outputs.finding }}"
          else
            echo "✓ File is clean"
          fi
```

## Advanced Configuration

### Custom API Endpoint

Use a different attachmentAV API region or endpoint:

```yaml
- uses: attachmentAV/scan@v1
  with:
    local-file-path: file.zip
    api-key: ${{ secrets.ATTACHMENTAV_API_KEY }}
    api-endpoint: https://us.developer.attachmentav.com
```

### Async Scan Tuning

For large files (≥200MB), adjust timeout and polling interval:

```yaml
- uses: attachmentAV/scan@v1
  with:
    release-asset-id: ${{ env.ASSET_ID }}
    api-key: ${{ secrets.ATTACHMENTAV_API_KEY }}
    token: ${{ github.token }}
    timeout: 600           # 10 minutes
    polling-interval: 10   # Check every 10 seconds
```

### Continue on Infection

Allow workflow to continue even if malware is detected:

```yaml
- uses: attachmentAV/scan@v1
  with:
    local-file-path: file.zip
    api-key: ${{ secrets.ATTACHMENTAV_API_KEY }}
    fail-on-infected: false
```

## How It Works

1. **Local Files (≤10MB)**: Uploaded directly to attachmentAV sync binary API
2. **Local Files (>10MB and ≤100MB)**: GitHub Contents API URL sent to attachmentAV sync download API
3. **Artifacts & Assets (<200MB)**: Download URL sent to attachmentAV sync download API
4. **Artifacts & Assets (≥200MB)**: Download URL sent to attachmentAV async API with automatic polling

The action handles GitHub's temporary download URLs automatically:

- Contents API URLs require authentication headers
- Artifact download URLs are valid for 1 minute
- Release asset download URLs are valid for 1 hour

## Troubleshooting

### "GitHub token is required for scanning artifacts"

Artifacts always require authentication. Provide the token input:

```yaml
token: ${{ github.token }}
```

### "GitHub token is required for scanning local files >10MB"

Local files between 10MB and 100MB require a GitHub token for authentication. Provide the token input:

```yaml
token: ${{ github.token }}
```

### "Local files >100MB are not supported"

Local files larger than 100MB cannot be scanned directly. Upload them as a release asset or artifact first.

### Permission Errors

Ensure your workflow has the necessary permissions:

```yaml
permissions:
  contents: read   # All scan types
  actions: read    # Required for artifacts
```

## Security

- Store your attachmentAV API key
  in [GitHub Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- The `token` input is securely passed to attachmentAV for authenticated downloads
- All communication with attachmentAV uses HTTPS

## License

MIT

## Support

- Documentation: [attachmentAV Docs](https://attachmentav.com/docs)
- Issues: [GitHub Issues](https://github.com/attachmentAV/scan/issues)
- API Support: support@attachmentav.com
