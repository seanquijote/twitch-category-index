/**
 * @file lib/store.js
 * @description Handles all file-system I/O for the game dataset.
 * Responsible for reading the existing `data/games.json` from disk and
 * writing the updated dataset back. Keeps all `fs` usage isolated from
 * the rest of the pipeline so other modules stay pure and I/O-free.
 */

import fs from "node:fs";
import { DATA_DIR, DATA_FILE, TWITCH_GAMES_URL } from "./config.js";

/** @import { Game, GamesOutput } from './types.js' */

/**
 * Builds the full {@link GamesOutput} envelope that gets serialised to disk.
 * Extracting this from {@link writeData} keeps the output shape independently
 * testable without touching the file system.
 *
 * @param {Game[]} games  - Complete, merged and sorted game list
 * @returns {GamesOutput} - Output object ready for `JSON.stringify`
 */
export function buildOutput(games) {
  return {
    meta: {
      last_synced: new Date().toISOString(),
      total: games.length,
      source: TWITCH_GAMES_URL,
    },
    games,
  };
}

/**
 * Reads the existing game dataset from disk and returns the `games` array.
 * Returns an empty array if the file does not exist or cannot be parsed,
 * logging a warning in the latter case.
 *
 * @param {string} [dataFile] - Path to read from; defaults to `data/games.json`
 * @returns {Game[]}          - Previously stored games, or `[]` if unavailable
 */
export function readData(dataFile = DATA_FILE) {
  if (!fs.existsSync(dataFile)) return [];

  try {
    const raw = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    return raw.games ?? [];
  } catch {
    console.warn("⚠️  Could not parse existing data file — starting fresh.");
    return [];
  }
}

/**
 * Serialises the game list to a JSON file, creating the parent directory if
 * it does not already exist. The file is written with 2-space indentation and
 * a trailing newline for clean git diffs.
 *
 * @param {Game[]} games      - Game list to persist
 * @param {string} [dataFile] - Destination file path; defaults to `data/games.json`
 * @param {string} [dataDir]  - Parent directory to create if absent; defaults to `data/`
 * @returns {void}
 */
export function writeData(games, dataFile = DATA_FILE, dataDir = DATA_DIR) {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const output = buildOutput(games);
  fs.writeFileSync(dataFile, JSON.stringify(output, null, 2) + "\n", "utf8");
  console.log(`💾 Written to ${dataFile}`);
}
