/**
 * @file lib/api.js
 * @description Twitch Helix API client for fetching the complete category list.
 * Handles cursor-based pagination and rate-limiting transparently, returning
 * all raw category objects as a single flat array.
 *
 * @see {@link https://dev.twitch.tv/docs/api/reference/#get-top-games}
 */

import { httpsGet, sleep } from "./http.js";
import { TWITCH_GAMES_URL, PAGE_SIZE, RATE_LIMIT_DELAY } from "./config.js";

/** @import { RawCategory, CategoriesResponse } from './types.js' */

/**
 * Fetches every game/category from the Twitch Helix `GET /games/top` endpoint by
 * following pagination cursors until the final page is reached.
 *
 * Requests are spaced {@link RATE_LIMIT_DELAY}ms apart to avoid overwhelming
 * the API. Progress is written to stdout as pages are fetched.
 *
 * The optional `_getFn` parameter is an escape hatch for tests — it defaults
 * to the real {@link httpsGet} in production but can be replaced with a mock
 * to avoid making live network requests during testing.
 *
 * @param {string}   clientId    - Twitch application client ID (sent as `Client-ID` header)
 * @param {string}   accessToken - Bearer token obtained from `getAccessToken`
 * @param {function} [_getFn] - HTTP GET function to use; defaults to `httpsGet`. Signature: `(url: string, headers: object) => Promise<CategoriesResponse>`
 * @returns {Promise<RawCategory[]>} - All raw category objects across all pages
 * @throws {Error} - If any individual page request fails
 *
 * @example
 * const token = await getAccessToken(clientId, clientSecret);
 * const categories = await fetchAllCategories(clientId, token);
 * console.log(categories.length); // → ~58000
 */
export async function fetchAllCategories(
  clientId,
  accessToken,
  _getFn = httpsGet,
) {
  const headers = {
    "Client-ID": clientId,
    Authorization: `Bearer ${accessToken}`,
  };

  /** @type {RawCategory[]} */
  const categories = [];
  let cursor = null;
  let page = 0;

  console.log("📡 Fetching categories from Twitch API...");

  do {
    page++;
    const params = new URLSearchParams({ first: String(PAGE_SIZE) });
    if (cursor) params.set("after", cursor);

    const url = `${TWITCH_GAMES_URL}?${params.toString()}`;
    const res = /** @type {CategoriesResponse} */ (await _getFn(url, headers));
    const data = res.data ?? [];

    categories.push(...data);
    cursor = res.pagination?.cursor ?? null;

    process.stdout.write(
      `\r   Page ${page} — ${categories.length} categories fetched so far...`,
    );

    if (cursor) await sleep(RATE_LIMIT_DELAY);
  } while (cursor);

  console.log(
    `\n✅ Done fetching. Total from API: ${categories.length} categories.`,
  );
  return categories;
}
