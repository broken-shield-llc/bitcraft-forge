export type LogLevel = "debug" | "info" | "warn" | "error";

export type Logger = {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

export function createLogger(level: LogLevel): Logger {
  const order: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  };
  const log = (l: LogLevel, ...args: unknown[]) => {
    if (order[l] < order[level]) return;
    const p = "[forge]";
    if (l === "error") console.error(p, l + ":", ...args);
    else console.log(p, l + ":", ...args);
  };
  return {
    debug: (...a) => log("debug", ...a),
    info: (...a) => log("info", ...a),
    warn: (...a) => log("warn", ...a),
    error: (...a) => log("error", ...a),
  };
}
