/**
 * @file lib/auth.js
 * @description Handles Twitch OAuth2 authentication via the Client Credentials
 * flow. This flow is server-to-server only — no user interaction or scopes are
 * required, making it suitable for automated sync pipelines like GitHub Actions.
 *
 * @see {@link https://dev.twitch.tv/docs/authentication/getting-tokens-oauth/#client-credentials-grant-flow}
 */

import { httpsPost } from "./http.js";
import { TWITCH_AUTH_URL } from "./config.js";

/** @import { TokenResponse } from './types.js' */

/**
 * Obtains a short-lived Twitch app access token using the Client Credentials
 * OAuth flow. The token is valid for approximately 60 days and only needs to
 * be refreshed when it expires or is revoked.
 *
 * @param {string} clientId     - Twitch application client ID
 * @param {string} clientSecret - Twitch application client secret
 * @returns {Promise<string>}   - Bearer access token for use in API request headers
 * @throws {Error}              - If the token request fails (e.g. invalid credentials)
 *
 * @example
 * const token = await getAccessToken(
 *   process.env.TWITCH_CLIENT_ID,
 *   process.env.TWITCH_CLIENT_SECRET,
 * );
 * // → "jostpf5q0puzmxmkba9iyug38kjtg"
 */
export async function getAccessToken(clientId, clientSecret) {
  console.log("🔑 Fetching Twitch app access token...");

  const res = /** @type {TokenResponse} */ (
    await httpsPost(TWITCH_AUTH_URL, {
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    })
  );

  console.log(`   Token expires in ${Math.floor(res.expires_in / 3600)}h`);
  return res.access_token;
}
