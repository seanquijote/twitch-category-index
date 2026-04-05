#!/usr/bin/env node

/**
 * @file scripts/sync.js
 * @description Entry point for the Twitch game list sync pipeline.
 * This file is intentionally thin — it reads environment variables, orchestrates
 * the pipeline by calling the appropriate modules, and handles top-level errors.
 * All business logic lives in `lib/`.
 *
 * @requires TWITCH_CLIENT_ID     - Twitch application client ID (env var)
 * @requires TWITCH_CLIENT_SECRET - Twitch application client secret (env var)
 *
 * @example
 * // Incremental sync (new and changed games only):
 * TWITCH_CLIENT_ID=xxx TWITCH_CLIENT_SECRET=yyy node scripts/sync.js
 *
 * @example
 * // Full resync (re-fetches everything, ignores existing data):
 * TWITCH_CLIENT_ID=xxx TWITCH_CLIENT_SECRET=yyy FULL_RESYNC=true node scripts/sync.js
 */

import { fileURLToPath } from "node:url";

import { getAccessToken } from "../lib/auth.js";
import { fetchAllGames } from "../lib/api.js";
import { mergeGames } from "../lib/transform.js";
import { readData, writeData } from "../lib/store.js";

/**
 * Orchestrates the full sync pipeline:
 * 1. Validates required environment variables
 * 2. Loads the existing dataset from disk (unless `FULL_RESYNC=true`)
 * 3. Obtains a Twitch app access token
 * 4. Fetches all games from the Twitch Helix API
 * 5. Merges fresh data into the existing dataset
 * 6. Writes the result back to disk
 *
 * Exits with code 1 if required environment variables are missing or if any
 * step throws an unhandled error.
 *
 * @returns {Promise<void>}
 */
async function main() {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  const fullResync = process.env.FULL_RESYNC === "true";

  if (!clientId || !clientSecret) {
    console.error("⚠️ TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET must be set.");
    process.exit(1);
  }

  const existing = fullResync ? [] : readData();

  if (fullResync) {
    console.log("🔄 Full resync requested — ignoring existing data.");
  } else {
    console.log(`📂 Loaded ${existing.length} existing games from disk.`);
  }

  const token = await getAccessToken(clientId, clientSecret);
  const fresh = await fetchAllGames(clientId, token);
  const merged = mergeGames(existing, fresh);

  writeData(merged);
  console.log("🎉 Sync complete.");
}

// Run only when executed directly (not when imported by tests or other modules)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error("💥 Sync failed:", err.message);
    process.exit(1);
  });
}
