import * as fs from "fs/promises";
import * as path from "path";

const MB = 1024 * 1024;
const MAX_SYNC_SIZE = 10 * MB; // 10MB
const MAX_ASYNC_SIZE = 5 * 1024 * 1024 * MB; // 5TB

export async function readFileAndCheckSize(
  filePath: string
): Promise<{ buffer: Buffer; size: number }> {
  // Resolve relative path from repository root
  const absolutePath = path.resolve(process.cwd(), filePath);

  // Check if file exists
  try {
    await fs.access(absolutePath);
  } catch (error) {
    throw new Error(`File not found: ${filePath}`);
  }

  // Get file stats
  const stats = await fs.stat(absolutePath);
  const size = stats.size;

  // Check file size limits
  if (size > MAX_ASYNC_SIZE) {
    throw new Error(
      `File size (${formatBytes(size)}) exceeds maximum supported size of 5TB`
    );
  }

  if (size > MAX_SYNC_SIZE) {
    throw new Error(
      `File size (${formatBytes(
        size
      )}) exceeds sync API limit of 10MB. Async API support for larger files is planned for a future release.`
    );
  }

  // Read file
  const buffer = await fs.readFile(absolutePath);

  return { buffer, size };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
