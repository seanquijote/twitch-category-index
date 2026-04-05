/**
 * @file lib/config.js
 * @description Central configuration for the sync pipeline.
 * All constants and resolved file-system paths live here so that
 * other modules never hard-code values or need to know about `__dirname`.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── File-system paths ────────────────────────────────────────────────────────

/**
 * Absolute path to the `data/` directory at the repo root.
 * Created automatically by {@link module:lib/store} if it does not exist.
 *
 * @type {string}
 */
export const DATA_DIR = path.join(__dirname, "..", "data");

/**
 * Absolute path to the canonical games dataset file.
 *
 * @type {string}
 */
export const DATA_FILE = path.join(DATA_DIR, "games.json");

// ─── Twitch API ───────────────────────────────────────────────────────────────

/**
 * Twitch OAuth2 token endpoint for the Client Credentials flow.
 *
 * @type {string}
 */
export const TWITCH_AUTH_URL = "https://id.twitch.tv/oauth2/token";

/**
 * Twitch Helix endpoint for fetching the list of top games.
 *
 * @type {string}
 */
export const TWITCH_GAMES_URL = "https://api.twitch.tv/helix/games/top";

/**
 * Number of games to request per page. 100 is the maximum the Twitch API allows.
 *
 * @type {number}
 */
export const PAGE_SIZE = 100;

/**
 * Milliseconds to wait between paginated requests to avoid hammering the API.
 *
 * @type {number}
 */
export const RATE_LIMIT_DELAY = 200;
