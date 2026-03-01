/**
 * Lightweight logger that silences debug output in production.
 *
 * Usage:
 *   import { log } from "@/lib/logger";
 *   log.debug("[Daily]", "joined meeting");     // silent in prod
 *   log.info("Pipeline: processing", debateId); // silent in prod
 *   log.warn("Unexpected state", data);          // always logged
 *   log.error("Failed to save", err);            // always logged
 *
 * In development (NODE_ENV !== "production"), all levels print.
 * In production, only warn and error print.
 */

const isDev =
  typeof process !== "undefined"
    ? process.env.NODE_ENV !== "production"
    : false;

const noop = () => {};

export const log = {
  /** Verbose debug output — silenced in production */
  debug: isDev ? console.log.bind(console) : noop,
  /** Informational messages — silenced in production */
  info: isDev ? console.log.bind(console) : noop,
  /** Warnings — always logged */
  warn: console.warn.bind(console),
  /** Errors — always logged */
  error: console.error.bind(console),
};
