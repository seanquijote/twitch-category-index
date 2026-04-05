/**
 * @file lib/store.js
 * @description Handles all file-system I/O for the category dataset.
 * Responsible for reading the existing `data/index.json` from disk and
 * writing the updated dataset back. Keeps all `fs` usage isolated from
 * the rest of the pipeline so other modules stay pure and I/O-free.
 */

import fs from "node:fs";
import { DATA_DIR, DATA_FILE, TWITCH_GAMES_URL } from "./config.js";

/** @import { RawCategory, CategoriesOutput } from './types.js' */

/**
 * Builds the full {@link CategoriesOutput} envelope that gets serialised to disk.
 * Extracting this from {@link writeData} keeps the output shape independently
 * testable without touching the file system.
 *
 * @param {Category[]} categories  - Complete, merged and sorted category list
 * @returns {CategoriesOutput} - Output object ready for `JSON.stringify`
 */
export function buildOutput(categories) {
  return {
    meta: {
      last_synced: new Date().toISOString(),
      total: categories.length,
      source: TWITCH_GAMES_URL,
    },
    categories,
  };
}

/**
 * Reads the existing category dataset from disk and returns the `categories` array.
 * Returns an empty array if the file does not exist or cannot be parsed,
 * logging a warning in the latter case.
 *
 * @param {string} [dataFile] - Path to read from; defaults to `data/index.json`
 * @returns {Category[]}          - Previously stored categories, or `[]` if unavailable
 */
export function readData(dataFile = DATA_FILE) {
  if (!fs.existsSync(dataFile)) return [];

  try {
    const raw = JSON.parse(fs.readFileSync(dataFile, "utf8"));
    return raw.categories ?? [];
  } catch {
    console.warn("⚠️  Could not parse existing data file — starting fresh.");
    return [];
  }
}

/**
 * Serialises the category list to a JSON file, creating the parent directory if
 * it does not already exist. The file is written with 2-space indentation and
 * a trailing newline for clean git diffs.
 *
 * @param {Category[]} categories - Category list to persist
 * @param {string} [dataFile] - Destination file path; defaults to `data/index.json`
 * @param {string} [dataDir] - Parent directory to create if absent; defaults to `data/`
 * @returns {void}
 */
export function writeData(
  categories,
  dataFile = DATA_FILE,
  dataDir = DATA_DIR,
) {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const output = buildOutput(categories);
  fs.writeFileSync(dataFile, JSON.stringify(output, null, 2) + "\n", "utf8");
  console.log(`💾 Written to ${dataFile}`);
}
