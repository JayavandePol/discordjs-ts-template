import { pino, stdSerializers, type Logger as PinoLogger, type LoggerOptions } from "pino";

export type LogLevel = "debug" | "info" | "warn" | "error";

// Keys whose values are replaced with "[redacted]" wherever they appear in log metadata
const REDACT_PATHS = [
  "token",
  "*.token",
  "authorization",
  "*.authorization",
  "password",
  "*.password",
  "meta.options",
];

// Pretty output only in development, and only when pino-pretty (a dev dependency) is installed
const prettyTransport = (): LoggerOptions["transport"] => {
  if (process.env.NODE_ENV === "production" || process.env.LOG_FORMAT === "json") return undefined;
  try {
    import.meta.resolve("pino-pretty");
  } catch {
    return undefined;
  }
  return { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss" } };
};

// Normalizes the second logger argument into a pino merge object.
// Errors are always serialized with name, message, stack and cause instead of becoming `{}`.
const toMergeObject = (meta: unknown): Record<string, unknown> | undefined => {
  if (meta === undefined || meta === null || meta === "") return undefined;
  if (meta instanceof Error) return { err: meta };
  if (typeof meta === "object" && !Array.isArray(meta)) return meta as Record<string, unknown>;
  return { meta };
};

/**
 * Structured JSON logger writing to stdout (pretty-printed in development).
 * Log files, rotation and shipping are left to the runtime (Docker, systemd, PM2).
 */
export class Logger {
  readonly pino: PinoLogger;

  constructor(level: LogLevel = "info", instance?: PinoLogger) {
    this.pino =
      instance ??
      pino({
        level,
        redact: { paths: REDACT_PATHS, censor: "[redacted]" },
        serializers: { err: stdSerializers.err, error: stdSerializers.err },
        transport: prettyTransport(),
      });
  }

  setLevel(level: LogLevel) {
    this.pino.level = level;
  }

  child(bindings: Record<string, unknown>): Logger {
    return new Logger(this.pino.level as LogLevel, this.pino.child(bindings));
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

  /** Flushes buffered output; resolves after at most `timeoutMs` even if the destination hangs. */
  flush(timeoutMs = 2000): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, timeoutMs);
      timer.unref();
      try {
        this.pino.flush(() => {
          clearTimeout(timer);
          resolve();
        });
      } catch {
        clearTimeout(timer);
        resolve();
      }
    });
  }

  private write(level: LogLevel, message: string, meta?: unknown) {
    const merge = toMergeObject(meta);
    try {
      if (merge) this.pino[level](merge, message);
      else this.pino[level](message);
    } catch (logError) {
      // Logging must never take the bot down (e.g. a BigInt or circular value in metadata)
      process.stderr.write(`[logger] failed to write log line: ${String(logError)} | ${message}\n`);
    }
  }
}
