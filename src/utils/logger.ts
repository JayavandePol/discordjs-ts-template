import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type LogLevel = "debug" | "info" | "warn" | "error";

// Priority weights for filtering log level output
const levelPriority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

// Resolve logs output directory
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logDir = path.resolve(__dirname, "../../logs");

/**
 * Structured Logger that writes human-readable messages to stdout/stderr
 * and appends structured JSON lines to daily log files on disk.
 */
export class Logger {
  private currentLevel: LogLevel;
  private stream: fs.WriteStream | null = null;

  constructor(level: LogLevel = "info") {
    this.currentLevel = level;
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  // Updates active minimum log level dynamically
  setLevel(level: LogLevel) {
    this.currentLevel = level;
  }

  // Log debug messages (verbose internal state)
  debug(message: string, meta?: unknown) {
    this.write("debug", message, meta);
  }

  // Log informational messages (standard operational events)
  info(message: string, meta?: unknown) {
    this.write("info", message, meta);
  }

  // Log warning messages (non-fatal issues or permission blocks)
  warn(message: string, meta?: unknown) {
    this.write("warn", message, meta);
  }

  // Log error messages (uncaught exceptions or failed operations)
  error(message: string, meta?: unknown) {
    this.write("error", message, meta);
  }

  // Internal write pipeline
  private write(level: LogLevel, message: string, meta?: unknown) {
    if (levelPriority[level] < levelPriority[this.currentLevel]) return;

    const timestamp = new Date().toISOString();
    const record = { timestamp, level, message, meta };
    const line = JSON.stringify(record);

    // Console output with appropriate stream method
    const consoleMethod =
      level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    consoleMethod(`${timestamp} [${level.toUpperCase()}] ${message}`, meta ?? "");

    // Daily rotating file stream write
    const fileName = path.join(logDir, `${timestamp.slice(0, 10)}.log`);
    if (!this.stream || this.stream.path !== fileName) {
      this.stream?.end();
      this.stream = fs.createWriteStream(fileName, { flags: "a" });
    }
    this.stream.write(line + "\n");
  }
}
