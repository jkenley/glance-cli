/**
 * Logging utility for Glance CLI
 */

import chalk from "chalk";

export type LogLevel = "debug" | "info" | "warn" | "error";

class Logger {
  private level: LogLevel = "info";

  setLevel(level: LogLevel) {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  debug(...args: any[]) {
    if (this.level === "debug") {
      console.log(chalk.gray("[DEBUG]"), ...args);
    }
  }

  info(...args: any[]) {
    if (["debug", "info"].includes(this.level)) {
      console.log(chalk.blue("[INFO]"), ...args);
    }
  }

  warn(...args: any[]) {
    if (["debug", "info", "warn"].includes(this.level)) {
      console.warn(chalk.yellow("[WARN]"), ...args);
    }
  }

  error(...args: any[]) {
    console.error(chalk.red("[ERROR]"), ...args);
  }
}

export const logger = new Logger();