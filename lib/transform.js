/**
 * @file lib/transform.js
 * @description Pure data transformation functions for the game dataset.
 * These functions have no side effects and perform no I/O — they take data in
 * and return data out, making them straightforward to unit test in isolation.
 *
 * Responsibilities:
 * - Normalising raw Twitch API game objects into clean {@link Game} records
 * - Merging a fresh API response into the existing on-disk dataset
 */

/** @import { Game, RawGame } from './types.js' */

/**
 * Converts a raw Twitch API game object into a clean, normalised {@link Game} record.
 *
 * The primary transformation is replacing any hardcoded pixel dimensions in
 * `box_art_url` (e.g. `285x380`) with `{width}x{height}` template placeholders.
 * This keeps the stored URLs dimension-agnostic so consumers can substitute
 * whatever resolution they need at runtime without requiring a re-sync.
 *
 * @param {RawGame} raw - Raw game object as returned by the Twitch Helix API
 * @returns {Game}      - Normalised game record ready for storage
 *
 * @example
 * normaliseGame({
 *   id: '509658',
 *   name: 'Just Chatting',
 *   box_art_url: 'https://static-cdn.jtvnw.net/ttv-boxart/509658-285x380.jpg',
 * });
 * // → {
 * //     id: '509658',
 * //     name: 'Just Chatting',
 * //     box_art_url: 'https://static-cdn.jtvnw.net/ttv-boxart/509658-{width}x{height}.jpg',
 * //     igdb_id: null,
 * //   }
 */
export function normaliseGame(raw) {
  const boxArtUrl = (raw.box_art_url ?? "").replace(
    /\d+x\d+/g,
    "{width}x{height}",
  );

  return {
    id: raw.id,
    name: raw.name,
    box_art_url: boxArtUrl,
    igdb_id: raw.igdb_id || null,
  };
}

/**
 * Merges a fresh batch of raw API games into the existing on-disk dataset,
 * returning a new sorted array without mutating either input.
 *
 * Merge rules:
 * - Games in `existing` that are absent from `fresh` are **retained** unchanged.
 * - Games in `fresh` that are absent from `existing` are **added**.
 * - Games present in both are **updated** only if `name`, `box_art_url`, or
 *   `igdb_id` has changed — unchanged entries are left as-is to avoid
 *   unnecessary disk writes.
 * - The final result is **sorted by numeric game ID** in ascending order.
 *
 * @param {Game[]}    existing - Games currently stored in `data/index.json`
 * @param {RawGame[]} fresh    - Raw games just fetched from the Twitch API
 * @returns {Game[]}           - Merged, normalised, and sorted game list
 *
 * @example
 * const merged = mergeGames(existingGames, freshGames);
 * // merged contains all existing games plus any new/updated ones from fresh
 */
export function mergeGames(existing, fresh) {
  /** @type {Record<string, Game>} */
  const byId = Object.fromEntries(existing.map((g) => [g.id, g]));

  let added = 0;
  let updated = 0;

  for (const raw of fresh) {
    const game = normaliseGame(raw);

    if (!byId[game.id]) {
      byId[game.id] = game;
      added++;
    } else {
      const prev = byId[game.id];
      const hasChanged =
        prev.name !== game.name ||
        prev.box_art_url !== game.box_art_url ||
        prev.igdb_id !== game.igdb_id;

      if (hasChanged) {
        byId[game.id] = { ...prev, ...game };
        updated++;
      }
    }
  }

  const merged = Object.values(byId).sort(
    (a, b) => Number(a.id) - Number(b.id),
  );

  console.log(`   ➕ New games added : ${added}`);
  console.log(`   ✏️  Games updated  : ${updated}`);
  console.log(`   📦 Total in dataset: ${merged.length}`);

  return merged;
}
