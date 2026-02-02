import * as core from "@actions/core";
import { readFileAndCheckSize } from "./fileUtils";
import { scanFileSync } from "./api";

async function run(): Promise<void> {
  try {
    // Get inputs
    const filePath = core.getInput("file-path", { required: true });
    const apiKey = core.getInput("api-key", { required: true });
    const failOnInfected = core.getBooleanInput("fail-on-infected");

    core.info(`Scanning file: ${filePath}`);

    // Read file and check size
    const { buffer, size } = await readFileAndCheckSize(filePath);
    core.info(`File size: ${size} bytes`);

    // Scan file using sync API
    core.info("Sending file to AttachmentAV for scanning...");
    const result = await scanFileSync(buffer, apiKey);

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
      core.info("File could not be scanned (unsupported file type)");
    }
  } catch (error) {
    core.setFailed((error as Error).message);
  }
}

run();
