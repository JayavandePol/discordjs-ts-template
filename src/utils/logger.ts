import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

type LogLevel = "debug" | "info" | "warn" | "error";

const levelPriority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logDir = path.resolve(__dirname, "../../logs");

export class Logger {
  private currentLevel: LogLevel;
  private stream: fs.WriteStream | null = null;

  constructor(level: LogLevel = "info") {
    this.currentLevel = level;
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  setLevel(level: LogLevel) {
    this.currentLevel = level;
  }

  debug(message: string, meta?: unknown) {
    this.write("debug", message, meta);
  }

  info(message: string, meta?: unknown) {
    this.write("info", message, meta);
  }

  warn(message: string, meta?: unknown) {
    this.write("warn", message, meta);
  }

  error(message: string, meta?: unknown) {
    this.write("error", message, meta);
  }

  private write(level: LogLevel, message: string, meta?: unknown) {
    if (levelPriority[level] < levelPriority[this.currentLevel]) return;

    const timestamp = new Date().toISOString();
    const record = { timestamp, level, message, meta };
    const line = JSON.stringify(record);

    // Console output stays lightweight for quick debugging.
    const consoleMethod =
      level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    consoleMethod(`${timestamp} [${level.toUpperCase()}] ${message}`, meta ?? "");

    // Append to log file per day.
    const fileName = path.join(logDir, `${timestamp.slice(0, 10)}.log`);
    if (!this.stream || this.stream.path !== fileName) {
      this.stream?.end();
      this.stream = fs.createWriteStream(fileName, { flags: "a" });
    }
    this.stream.write(line + "\n");
  }
}
