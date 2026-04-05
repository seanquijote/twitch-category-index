/**
 * @file lib/transform.js
 * @description Pure data transformation functions for the category dataset.
 * These functions have no side effects and perform no I/O — they take data in
 * and return data out, making them straightforward to unit test in isolation.
 *
 * Responsibilities:
 * - Normalising raw Twitch API category objects into clean {@link Category} records
 * - Merging a fresh API response into the existing on-disk dataset
 */

/** @import { Category, RawCategory } from './types.js' */

/**
 * Converts a raw Twitch API category object into a clean, normalised {@link Category} record.
 *
 * The primary transformation is replacing any hardcoded pixel dimensions in
 * `box_art_url` (e.g. `285x380`) with `{width}x{height}` template placeholders.
 * This keeps the stored URLs dimension-agnostic so consumers can substitute
 * whatever resolution they need at runtime without requiring a re-sync.
 *
 * @param {RawCategory} raw - Raw category object as returned by the Twitch Helix API
 * @returns {Category}      - Normalised category record ready for storage
 *
 * @example
 * normaliseCategory({
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
export function normaliseCategory(raw) {
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
 * Merges a fresh batch of raw API categories into the existing on-disk dataset,
 * returning a new sorted array without mutating either input.
 *
 * Merge rules:
 * - Categories in `existing` that are absent from `fresh` are **retained** unchanged.
 * - Categories in `fresh` that are absent from `existing` are **added**.
 * - Categories present in both are **updated** only if `name`, `box_art_url`, or
 *   `igdb_id` has changed — unchanged entries are left as-is to avoid
 *   unnecessary disk writes.
 * - The final result is **sorted by numeric category ID** in ascending order.
 *
 * @param {Category[]} existing - Categories currently stored in `data/index.json`
 * @param {RawCategory[]} fresh - Raw categories just fetched from the Twitch API
 * @returns {Category[]} - Merged, normalised, and sorted category list
 *
 * @example
 * const merged = mergeCategories(existingCategories, freshCategories);
 * // merged contains all existing categories plus any new/updated ones from fresh
 */
export function mergeCategories(existing, fresh) {
  /** @type {Record<string, Category>} */
  const byId = Object.fromEntries(existing.map((g) => [g.id, g]));

  let added = 0;
  let updated = 0;

  for (const raw of fresh) {
    const category = normaliseCategory(raw);

    if (!byId[category.id]) {
      byId[category.id] = category;
      added++;
    } else {
      const prev = byId[category.id];
      const hasChanged =
        prev.name !== category.name ||
        prev.box_art_url !== category.box_art_url ||
        prev.igdb_id !== category.igdb_id;

      if (hasChanged) {
        byId[category.id] = { ...prev, ...category };
        updated++;
      }
    }
  }

  const merged = Object.values(byId).sort(
    (a, b) => Number(a.id) - Number(b.id),
  );

  console.log(`   ➕ New categories added: ${added}`);
  console.log(`   ✏️ Categories updated: ${updated}`);
  console.log(`   📦 Total in dataset: ${merged.length}`);

  return merged;
}
