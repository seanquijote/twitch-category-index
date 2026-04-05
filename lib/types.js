/**
 * @file lib/types.js
 * @description Shared JSDoc type definitions used across all modules.
 * This file contains no runtime code — it exists purely for documentation
 * and editor intellisense. Import it with a `@import` or reference it in
 * JSDoc `@type` annotations as needed.
 */

/**
 * A normalised game record as stored in `data/games.json`.
 *
 * @typedef {object} Game
 * @property {string}      id          - Twitch game ID (numeric string, e.g. "509658")
 * @property {string}      name        - Display name of the game
 * @property {string}      box_art_url - Box art URL template; replace `{width}` and
 *                                       `{height}` with pixel dimensions at runtime.
 *                                       e.g. `url.replace('{width}', 285).replace('{height}', 380)`
 * @property {string|null} igdb_id     - IGDB identifier, or null if unavailable
 */

/**
 * The shape of a raw game object returned directly by the Twitch Helix API
 * before normalisation.
 *
 * @typedef {object} RawGame
 * @property {string}             id          - Twitch game ID
 * @property {string}             name        - Display name
 * @property {string}             box_art_url - Box art URL with hardcoded pixel dimensions
 * @property {string|number|null} [igdb_id]   - IGDB ID; may be absent, zero, or an empty string
 */

/**
 * The top-level structure written to `data/games.json`.
 *
 * @typedef {object} GamesOutput
 * @property {object} meta             - Metadata about the last sync run
 * @property {string} meta.last_synced - ISO 8601 timestamp of the most recent sync
 * @property {number} meta.total       - Total number of games in the dataset
 * @property {string} meta.source      - Twitch API endpoint the data was sourced from
 * @property {Game[]} games            - Full sorted list of normalised games
 */

/**
 * Twitch client-credentials token response.
 *
 * @typedef {object} TokenResponse
 * @property {string} access_token - Bearer token for use in subsequent API requests
 * @property {number} expires_in   - Seconds until the token expires (~60 days typically)
 * @property {string} token_type   - Always `"bearer"`
 */

/**
 * Twitch Helix paginated response for the `GET /games/top` endpoint.
 *
 * @typedef {object} GamesResponse
 * @property {RawGame[]}           data       - Array of game objects on this page
 * @property {{ cursor?: string }} pagination - Pagination state; empty object signals the last page
 */

export {};
