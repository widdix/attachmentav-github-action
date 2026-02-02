# CLAUDE.md - Development Guidelines

This document contains important guidelines and conventions for working with this codebase.

## Brand Name: attachmentAV

**CRITICAL**: The correct casing for the product name is **attachmentAV** (not AttachmentAV, not Attachmentav, not attachmentav).

### Where to use attachmentAV:
- User-facing messages (log messages, error messages, info messages)
- Comments that reference the product
- Documentation and README files
- Natural language references to the service

### Where to use AttachmentAV:
- Variable names, function names, interface names (following TypeScript naming conventions)
- Class names and type definitions
- Code identifiers that require PascalCase

### Examples:

✅ **Correct:**
```typescript
core.info("Starting attachmentAV malware scan...");
core.error("attachmentAV API error: 401 Unauthorized");
throw new Error("Local files cannot be directly accessed by attachmentAV");
```

❌ **Incorrect:**
```typescript
core.info("Starting AttachmentAV malware scan...");
core.error("Attachmentav API error: 401 Unauthorized");
```

✅ **Correct for code identifiers:**
```typescript
interface AttachmentAVResponse { ... }
function scanFileAttachmentAV() { ... }
const attachmentAVConfig = { ... };
```

## Architecture

### File Structure
- `src/index.ts` - Main entry point, orchestration logic
- `src/api.ts` - AttachmentAV API interactions (sync and async)
- `src/github.ts` - GitHub API interactions (artifacts and releases)
- `src/fileUtils.ts` - File system operations
- `src/types.ts` - TypeScript type definitions
- `src/utils.ts` - Utility functions (trace ID, sleep)

### Function Parameter Order Convention
For consistency, API functions follow this parameter order:
1. `apiEndpoint` - The API endpoint URL
2. `apiKey` - The API authentication key
3. Additional parameters (buffer, traceId, etc.)

Example:
```typescript
scanFileSync(apiEndpoint: string, apiKey: string, buffer: Buffer)
```

### Input Validation
- All input validation happens in `getInputs()` function
- Mutually exclusive inputs are validated
- Numeric inputs (timeout, polling-interval) are validated for range: 1 second to 1 hour (3600 seconds)
- Invalid inputs throw errors with clear messages

### Error Handling
- Input validation errors caught in `run()` and reported via `core.setFailed()`
- API errors include detailed logging with error messages and stack traces
- Use `core.error()` for error details before throwing
- Use `core.debug()` for debugging information

## API Integration

### Sync API
- Used for local files ≤ 10MB
- Endpoint: `/v1/scan/sync/binary`
- Method: POST with binary body
- Streams file content using Node.js Readable stream

### Async API
- Used for GitHub artifacts and release assets
- Submit endpoint: `/v1/scan/async/download`
- Result endpoint: `/v1/scan/async/result?trace_id={id}`
- Polling continues until result is ready (HTTP 200) or timeout
- 404 response means result not ready yet

### Authentication
- attachmentAV API: Uses `x-api-key` header
- GitHub API: Uses bearer token via Octokit
- Token forwarding: GitHub token sent to attachmentAV as `Authorization: Bearer {token}` in `download_headers`

## Scan Targets

### Local Files
- Must be ≤ 10MB (sync API limitation)
- Path resolved relative to repository root
- Files > 10MB require upload as release asset or artifact first

### GitHub Artifacts
- Always use async API
- Requires artifact ID
- Uses `archive_download_url` from GitHub API
- Optional GitHub token for private artifacts

### GitHub Release Assets
- Always use async API
- Requires release asset ID
- Uses `url` (not `browser_download_url`) to allow attachmentAV to follow redirects
- Optional GitHub token for private releases

## Inputs

All inputs are defined in `action.yml`:

### Required
- `api-key` - attachmentAV API key (from secrets)

### Scan Target (mutually exclusive, one required)
- `local-file-path` - Path to local file
- `artifact-id` - GitHub Actions artifact ID
- `release-asset-id` - GitHub release asset ID

### Optional
- `api-endpoint` - Default: `https://eu.developer.attachmentav.com`
- `token` - GitHub token for private resources
- `timeout` - Default: 300 seconds, max: 3600, min: 1
- `polling-interval` - Default: 5 seconds, max: 3600, min: 1
- `fail-on-infected` - Default: true

## Outputs

- `status` - Scan result: `clean`, `infected`, or `no`
- `finding` - Malware type if infected (optional)
- `file-size` - Size in bytes
- `real-file-type` - Detected file type (optional)

## Logging Conventions

### Info Messages
Use `core.info()` for normal operation flow:
```typescript
core.info("Starting attachmentAV malware scan...");
core.info("✓ File is clean - no malware detected");
```

### Debug Messages
Use `core.debug()` for detailed debugging (only shown with ACTIONS_STEP_DEBUG=true):
```typescript
core.debug(`Working directory: ${process.cwd()}`);
core.debug(`Buffer size: ${buffer.length} bytes`);
```

### Warning Messages
Use `core.warning()` for non-fatal issues:
```typescript
core.warning(`Malware detected: ${result.finding}`);
```

### Error Messages
Use `core.error()` for error details before throwing:
```typescript
core.error(`Failed to fetch artifact: ${error}`);
```

## Testing

### Local Testing
Use `test-local.ts` to test API integration:
```bash
ATTACHMENTAV_API_KEY=your-key npm run test:local
```

### Workflow Testing
The GitHub Actions workflow (`.github/workflows/main.yml`) tests:
1. Local file scanning
2. Artifact scanning
3. Release asset scanning

## Code Style

### TypeScript
- Use strict mode
- Define interfaces for all data structures
- Prefer async/await over promises
- Use const for immutable values

### Naming
- Functions: camelCase (`scanFileSync`, `getReleaseAsset`)
- Interfaces/Types: PascalCase (`AttachmentAVResponse`, `ActionInputs`)
- Constants: UPPER_SNAKE_CASE (`MAX_SYNC_SIZE`, `ONE_HOUR_SECONDS`)
- Private helpers: camelCase with descriptive names

### Comments
- Use JSDoc style for public functions
- Inline comments for complex logic
- Reference attachmentAV correctly (lowercase A, uppercase V)

## Common Patterns

### Async Scan Workflow
1. Generate unique trace ID (UUID)
2. Submit scan with download URL and optional auth headers
3. Poll result endpoint with configurable interval
4. Return result or throw timeout error

### Error Messages
Be specific and actionable:
```typescript
throw new Error(
  "Local files >10MB require async API, but local files cannot be " +
  "directly accessed by attachmentAV. Please upload the file as a " +
  "release asset or artifact first."
);
```

## Dependencies

### Runtime
- `@actions/core` - GitHub Actions toolkit
- `@actions/github` - GitHub API client

### Development
- `typescript` - Type checking
- `rollup` - Bundling
- `@rollup/plugin-typescript` - TypeScript support
- `tsx` - Running TypeScript directly for testing

## Build Process

```bash
npm run build
```

- Entry: `src/index.ts`
- Output: `dist/index.mjs` (ES modules)
- Includes source maps
- Bundles all dependencies

## Node.js Version

**CRITICAL**: Always use `node24` in `action.yml`

- Action runs on Node.js 24 (specified in `action.yml` as `using: node24`)
- **DO NOT use `node22`** - it is not a supported runtime in GitHub Actions
- Supported runtimes in GitHub Actions: `node20`, `node24`
- Node.js 24 provides better native fetch support and improved stream handling
