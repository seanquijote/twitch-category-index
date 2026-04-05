#!/usr/bin/env node
/**
 * sync.js
 * Fetches all games from the Twitch API and updates game_info.json,
 * game_info.csv, game_info.csv_semicolon, and game_info.sql.
 *
 * Required env vars:
 *   TWITCH_CLIENT_ID     - Your Twitch app client ID
 *   TWITCH_CLIENT_SECRET - Your Twitch app client secret
 *
 * Optional env vars:
 *   FULL_RESYNC          - Set to "true" to ignore existing data and re-fetch everything
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

// ─── File paths ───────────────────────────────────────────────────────────────
const PATHS = {
  json: path.join(ROOT, "game_info.json"),
  csv: path.join(ROOT, "game_info.csv"),
  csvSemi: path.join(ROOT, "game_info.csv_semicolon"),
  sql: path.join(ROOT, "game_info.sql"),
  meta: path.join(ROOT, "sync_meta.json"),
};

// ─── Twitch API helpers ───────────────────────────────────────────────────────

async function getAccessToken(clientId, clientSecret) {
  const res = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to get Twitch token: ${res.status} ${body}`);
  }

  const { access_token } = await res.json();
  return access_token;
}

/**
 * Fetches all games from GET /helix/games/top using cursor-based pagination.
 * Returns an array of { id, name, box_art_url } objects.
 *
 * NOTE: The Twitch API only exposes "top games" via cursor pagination — there
 * is no "get all games" endpoint. This syncs the current top ~500 games, which
 * covers the vast majority of actively streamed titles. For a full historical
 * catalog, keep the existing data and only upsert new entries.
 */
async function fetchAllGames(clientId, accessToken) {
  const games = [];
  let cursor = null;
  let page = 1;

  console.log("Fetching games from Twitch API...");

  do {
    const url = new URL("https://api.twitch.tv/helix/games/top");
    url.searchParams.set("first", "100"); // max allowed per page
    if (cursor) url.searchParams.set("after", cursor);

    const res = await fetch(url.toString(), {
      headers: {
        "Client-ID": clientId,
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (res.status === 429) {
      // Rate limited — back off and retry once
      const retryAfter = parseInt(
        res.headers.get("Ratelimit-Reset") || "1",
        10,
      );
      const waitMs = Math.max(
        (retryAfter - Math.floor(Date.now() / 1000)) * 1000,
        1000,
      );
      console.warn(`Rate limited on page ${page}. Waiting ${waitMs}ms...`);
      await sleep(waitMs);
      continue; // retry same page
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Twitch API error on page ${page}: ${res.status} ${body}`,
      );
    }

    const json = await res.json();
    const data = json.data ?? [];

    for (const game of data) {
      games.push({
        id: game.id,
        name: game.name,
        box_art_url: game.box_art_url, // stored as template: ...{width}x{height}.jpg
      });
    }

    cursor = json.pagination?.cursor ?? null;
    console.log(
      `  Page ${page}: fetched ${data.length} games (total so far: ${games.length})`,
    );
    page++;

    // Small polite delay between pages to avoid hammering the API
    if (cursor) await sleep(200);
  } while (cursor);

  console.log(`Done. Total games fetched: ${games.length}`);
  return games;
}

// ─── Merge helpers ────────────────────────────────────────────────────────────

function loadExistingGames() {
  if (!fs.existsSync(PATHS.json)) return [];
  try {
    return JSON.parse(fs.readFileSync(PATHS.json, "utf8"));
  } catch {
    console.warn("Could not parse existing game_info.json — starting fresh.");
    return [];
  }
}

/**
 * Merges freshly fetched games into the existing dataset.
 * - New games are added.
 * - Existing games get their name and box_art_url updated if changed.
 * - Games removed from Twitch are kept (Twitch doesn't reuse IDs).
 * Returns { merged, added, updated }.
 */
function mergeGames(existing, fresh) {
  const byId = new Map(existing.map((g) => [g.id, { ...g }]));
  let added = 0;
  let updated = 0;

  for (const game of fresh) {
    if (!byId.has(game.id)) {
      byId.set(game.id, game);
      added++;
    } else {
      const current = byId.get(game.id);
      let changed = false;
      if (current.name !== game.name) {
        current.name = game.name;
        changed = true;
      }
      if (current.box_art_url !== game.box_art_url) {
        current.box_art_url = game.box_art_url;
        changed = true;
      }
      if (changed) updated++;
    }
  }

  // Sort numerically by id for clean, stable diffs
  const merged = [...byId.values()].sort((a, b) => Number(a.id) - Number(b.id));
  return { merged, added, updated };
}

// ─── Export writers ───────────────────────────────────────────────────────────

function writeJson(games) {
  fs.writeFileSync(PATHS.json, JSON.stringify(games, null, 2) + "\n", "utf8");
  console.log(`Wrote ${games.length} entries → game_info.json`);
}

function escapeCsv(value) {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function escapeCsvSemicolon(value) {
  const str = String(value ?? "");
  if (str.includes(";") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function writeCsv(games) {
  const header = "id,name,box_art_url\n";
  const rows = games.map((g) =>
    [escapeCsv(g.id), escapeCsv(g.name), escapeCsv(g.box_art_url)].join(","),
  );
  fs.writeFileSync(PATHS.csv, header + rows.join("\n") + "\n", "utf8");
  console.log(`Wrote ${games.length} entries → game_info.csv`);
}

function writeCsvSemicolon(games) {
  const header = "id;name;box_art_url\n";
  const rows = games.map((g) =>
    [
      escapeCsvSemicolon(g.id),
      escapeCsvSemicolon(g.name),
      escapeCsvSemicolon(g.box_art_url),
    ].join(";"),
  );
  fs.writeFileSync(PATHS.csvSemi, header + rows.join("\n") + "\n", "utf8");
  console.log(`Wrote ${games.length} entries → game_info.csv_semicolon`);
}

function escapeSqlString(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}

function writeSql(games) {
  const lines = [
    "-- Auto-generated by sync.js. Do not edit manually.",
    `-- Last synced: ${new Date().toISOString()}`,
    "",
    "CREATE TABLE IF NOT EXISTS `game_info` (",
    "  `id` VARCHAR(20) NOT NULL,",
    "  `name` VARCHAR(255) NOT NULL,",
    "  `box_art_url` TEXT NOT NULL,",
    "  PRIMARY KEY (`id`)",
    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",
    "",
    "INSERT INTO `game_info` (`id`, `name`, `box_art_url`) VALUES",
  ];

  const valueRows = games.map((g, i) => {
    const comma = i < games.length - 1 ? "," : ";";
    return `  ('${escapeSqlString(g.id)}', '${escapeSqlString(g.name)}', '${escapeSqlString(g.box_art_url)}')${comma}`;
  });

  fs.writeFileSync(
    PATHS.sql,
    lines.join("\n") + "\n" + valueRows.join("\n") + "\n",
    "utf8",
  );
  console.log(`Wrote ${games.length} entries → game_info.sql`);
}

function writeMeta(stats) {
  const meta = {
    last_synced_at: new Date().toISOString(),
    total_games: stats.total,
    added: stats.added,
    updated: stats.updated,
  };
  fs.writeFileSync(PATHS.meta, JSON.stringify(meta, null, 2) + "\n", "utf8");
  console.log("Wrote → sync_meta.json");
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  const fullResync = process.env.FULL_RESYNC === "true";

  if (!clientId || !clientSecret) {
    console.error(
      "Error: TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET must be set.",
    );
    process.exit(1);
  }

  console.log(`Mode: ${fullResync ? "FULL RESYNC" : "incremental update"}`);

  // 1. Auth
  const accessToken = await getAccessToken(clientId, clientSecret);

  // 2. Fetch from API
  const freshGames = await fetchAllGames(clientId, accessToken);

  // 3. Merge with existing (unless full resync)
  const existing = fullResync ? [] : loadExistingGames();
  const { merged, added, updated } = mergeGames(existing, freshGames);

  console.log(
    `\nSummary: ${added} added, ${updated} updated, ${merged.length} total`,
  );

  // 4. Write all output formats
  writeJson(merged);
  writeCsv(merged);
  writeCsvSemicolon(merged);
  writeSql(merged);
  writeMeta({ total: merged.length, added, updated });

  console.log("\nSync complete.");
}

main().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
