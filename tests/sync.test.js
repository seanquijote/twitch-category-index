/**
 * @file tests/sync.test.js
 * @description Unit tests for the sync pipeline modules.
 * Each `describe` block maps to exactly one module in `lib/`, keeping
 * test boundaries aligned with the separation of concerns in the source.
 *
 * Uses Node's built-in test runner — no extra dependencies needed.
 * All tests run fully offline; network calls are replaced with mock functions.
 *
 * @example
 * // Run all tests:
 * node --test tests/sync.test.js
 *
 * @example
 * // Verbose spec output:
 * node --test --test-reporter=spec tests/sync.test.js
 */

import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { normaliseCategory, mergeCategories } from "../lib/transform.js";
import { buildOutput, readData, writeData } from "../lib/store.js";
import { fetchAllCategories } from "../lib/api.js";

// ─── lib/transform.js — normaliseCategory ────────────────────────────────────────

describe("normaliseCategory", () => {
  test("replaces concrete dimensions with {width}x{height} placeholder", () => {
    const raw = {
      id: "509658",
      name: "Just Chatting",
      box_art_url: "https://static-cdn.jtvnw.net/ttv-boxart/509658-285x380.jpg",
      igdb_id: "1234",
    };
    assert.equal(
      normaliseCategory(raw).box_art_url,
      "https://static-cdn.jtvnw.net/ttv-boxart/509658-{width}x{height}.jpg",
    );
  });

  test("replaces all dimension occurrences in a single URL", () => {
    const raw = {
      id: "1",
      name: "Category",
      box_art_url: "https://example.com/52x72/art-600x800.jpg",
    };
    assert.equal(
      normaliseCategory(raw).box_art_url,
      "https://example.com/{width}x{height}/art-{width}x{height}.jpg",
    );
  });

  test("returns null for igdb_id when the field is absent", () => {
    assert.equal(
      normaliseCategory({ id: "1", name: "Category", box_art_url: "" }).igdb_id,
      null,
    );
  });

  test("returns null for igdb_id when the value is falsy (0 or empty string)", () => {
    assert.equal(
      normaliseCategory({
        id: "1",
        name: "Category",
        box_art_url: "",
        igdb_id: 0,
      }).igdb_id,
      null,
    );
    assert.equal(
      normaliseCategory({
        id: "1",
        name: "Category",
        box_art_url: "",
        igdb_id: "",
      }).igdb_id,
      null,
    );
  });

  test("preserves igdb_id when a truthy value is present", () => {
    assert.equal(
      normaliseCategory({
        id: "1",
        name: "Category",
        box_art_url: "",
        igdb_id: "9999",
      }).igdb_id,
      "9999",
    );
  });

  test("returns an empty string for box_art_url when the field is missing", () => {
    assert.equal(
      normaliseCategory({ id: "1", name: "Category" }).box_art_url,
      "",
    );
  });

  test("passes id and name through unchanged", () => {
    const result = normaliseCategory({
      id: "42",
      name: "Elden Ring",
      box_art_url: "",
    });
    assert.equal(result.id, "42");
    assert.equal(result.name, "Elden Ring");
  });

  test("handles the IGDB-style CDN URL format introduced in 2021", () => {
    const raw = {
      id: "515025",
      name: "Diablo IV",
      box_art_url:
        "https://static-cdn.jtvnw.net/ttv-boxart/515025_IGDB-285x380.jpg",
    };
    assert.equal(
      normaliseCategory(raw).box_art_url,
      "https://static-cdn.jtvnw.net/ttv-boxart/515025_IGDB-{width}x{height}.jpg",
    );
  });
});

// ─── lib/transform.js — mergeCategories ───────────────────────────────────────────

describe("mergeCategories", () => {
  test("adds new categories from a fresh list into an empty existing set", () => {
    const fresh = [
      {
        id: "1",
        name: "Alpha",
        box_art_url: "https://example.com/1-52x72.jpg",
      },
      { id: "2", name: "Beta", box_art_url: "https://example.com/2-52x72.jpg" },
    ];
    assert.equal(mergeCategories([], fresh).length, 2);
  });

  test("retains existing categories that are absent from the fresh list", () => {
    const existing = [
      { id: "1", name: "Alpha", box_art_url: "", igdb_id: null },
    ];
    const fresh = [{ id: "2", name: "Beta", box_art_url: "" }];
    const result = mergeCategories(existing, fresh);
    assert.equal(result.length, 2);
    assert.ok(
      result.find((g) => g.id === "1"),
      'Category with id "1" should still be present',
    );
  });

  test("does not duplicate a category that appears in both lists", () => {
    const category = { id: "1", name: "Alpha", box_art_url: "", igdb_id: null };
    assert.equal(
      mergeCategories([category], [{ id: "1", name: "Alpha", box_art_url: "" }])
        .length,
      1,
    );
  });

  test("updates name when it has changed in the fresh list", () => {
    const existing = [
      { id: "1", name: "Old Name", box_art_url: "", igdb_id: null },
    ];
    const fresh = [{ id: "1", name: "New Name", box_art_url: "" }];
    assert.equal(mergeCategories(existing, fresh)[0].name, "New Name");
  });

  test("updates box_art_url when it has changed in the fresh list", () => {
    const existing = [
      {
        id: "1",
        name: "Category",
        box_art_url: "https://old.com/1-52x72.jpg",
        igdb_id: null,
      },
    ];
    const fresh = [
      {
        id: "1",
        name: "Category",
        box_art_url: "https://new.com/1-285x380.jpg",
      },
    ];
    assert.equal(
      mergeCategories(existing, fresh)[0].box_art_url,
      "https://new.com/1-{width}x{height}.jpg",
    );
  });

  test("updates igdb_id when it has changed in the fresh list", () => {
    const existing = [
      { id: "1", name: "Category", box_art_url: "", igdb_id: null },
    ];
    const fresh = [
      { id: "1", name: "Category", box_art_url: "", igdb_id: "777" },
    ];
    assert.equal(mergeCategories(existing, fresh)[0].igdb_id, "777");
  });

  test("does not modify an entry when nothing has changed", () => {
    const existing = [
      { id: "1", name: "Category", box_art_url: "", igdb_id: null },
    ];
    const fresh = [{ id: "1", name: "Category", box_art_url: "" }];
    assert.deepEqual(mergeCategories(existing, fresh)[0], existing[0]);
  });

  test("sorts the output by numeric category ID in ascending order", () => {
    const existing = [{ id: "30", name: "C", box_art_url: "", igdb_id: null }];
    const fresh = [
      { id: "200", name: "D", box_art_url: "" },
      { id: "5", name: "A", box_art_url: "" },
      { id: "10", name: "B", box_art_url: "" },
    ];
    assert.deepEqual(
      mergeCategories(existing, fresh).map((g) => Number(g.id)),
      [5, 10, 30, 200],
    );
  });

  test("returns existing data unchanged when fresh list is empty", () => {
    const existing = [
      { id: "1", name: "Alpha", box_art_url: "", igdb_id: null },
    ];
    assert.deepEqual(mergeCategories(existing, []), existing);
  });

  test("returns an empty array when both lists are empty", () => {
    assert.deepEqual(mergeCategories([], []), []);
  });

  test("handles large lists (500 existing + 500 fresh with 250 overlap) without error", () => {
    const existing = Array.from({ length: 500 }, (_, i) => ({
      id: String(i),
      name: `Category ${i}`,
      box_art_url: "",
      igdb_id: null,
    }));
    const fresh = Array.from({ length: 500 }, (_, i) => ({
      id: String(i + 250),
      name: `Category ${i + 250}`,
      box_art_url: "",
    }));
    // ids 0–249 existing only, 250–499 overlap (no change), 500–749 new = 750 total
    assert.equal(mergeCategories(existing, fresh).length, 750);
  });
});

// ─── lib/store.js — buildOutput ──────────────────────────────────────────────

describe("buildOutput", () => {
  test("includes a meta block with the correct total and source URL", () => {
    const output = buildOutput([
      { id: "1", name: "Category", box_art_url: "", igdb_id: null },
    ]);
    assert.equal(output.meta.total, 1);
    assert.equal(output.meta.source, "https://api.twitch.tv/helix/games/top");
  });

  test("last_synced is a valid ISO 8601 date string", () => {
    const parsed = new Date(buildOutput([]).meta.last_synced);
    assert.ok(
      !isNaN(parsed.getTime()),
      "last_synced should parse as a valid date",
    );
  });

  test("embeds the categories array without modification", () => {
    const categories = [
      { id: "99", name: "Test", box_art_url: "", igdb_id: null },
    ];
    assert.deepEqual(buildOutput(categories).categories, categories);
  });

  test("sets total to zero when the categories list is empty", () => {
    assert.equal(buildOutput([]).meta.total, 0);
  });
});

// ─── lib/store.js — readData ─────────────────────────────────────────────────

describe("readData", () => {
  /** @type {string} */
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sync-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("returns an empty array when the file does not exist", () => {
    const result = readData(path.join(tmpDir, "nonexistent.json"));
    assert.deepEqual(result, []);
  });

  test("returns the categories array from a valid existing file", () => {
    const file = path.join(tmpDir, "index.json");
    const categories = [
      { id: "1", name: "Category", box_art_url: "", igdb_id: null },
    ];
    fs.writeFileSync(file, JSON.stringify({ meta: {}, categories }), "utf8");
    assert.deepEqual(readData(file), categories);
  });

  test("returns an empty array and warns when the file contains invalid JSON", () => {
    const file = path.join(tmpDir, "corrupt.json");
    fs.writeFileSync(file, "{ this is not json }", "utf8");
    assert.deepEqual(readData(file), []);
  });

  test("returns an empty array when the file has no categories key", () => {
    const file = path.join(tmpDir, "index.json");
    fs.writeFileSync(file, JSON.stringify({ meta: {} }), "utf8");
    assert.deepEqual(readData(file), []);
  });
});

// ─── lib/store.js — writeData ────────────────────────────────────────────────

describe("writeData", () => {
  /** @type {string} */
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "sync-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test("creates the data directory when it does not already exist", () => {
    const nestedDir = path.join(tmpDir, "nested", "data");
    const outputFile = path.join(nestedDir, "index.json");
    writeData([], outputFile, nestedDir);
    assert.ok(
      fs.existsSync(nestedDir),
      "Nested directory should have been created",
    );
  });

  test("writes syntactically valid JSON to the target file", () => {
    const outputFile = path.join(tmpDir, "index.json");
    writeData(
      [{ id: "1", name: "Category", box_art_url: "", igdb_id: null }],
      outputFile,
      tmpDir,
    );
    const parsed = JSON.parse(fs.readFileSync(outputFile, "utf8"));
    assert.equal(parsed.categories.length, 1);
  });

  test("ensures the written file ends with a trailing newline", () => {
    const outputFile = path.join(tmpDir, "index.json");
    writeData([], outputFile, tmpDir);
    assert.ok(
      fs.readFileSync(outputFile, "utf8").endsWith("\n"),
      'File should end with "\\n"',
    );
  });

  test("overwrites an existing file entirely with new content", () => {
    const outputFile = path.join(tmpDir, "index.json");
    writeData(
      [{ id: "1", name: "Old", box_art_url: "", igdb_id: null }],
      outputFile,
      tmpDir,
    );
    writeData(
      [{ id: "2", name: "New", box_art_url: "", igdb_id: null }],
      outputFile,
      tmpDir,
    );
    const parsed = JSON.parse(fs.readFileSync(outputFile, "utf8"));
    assert.equal(parsed.categories.length, 1);
    assert.equal(parsed.categories[0].name, "New");
  });

  test("records the correct total count in the meta block", () => {
    const outputFile = path.join(tmpDir, "index.json");
    const categories = Array.from({ length: 5 }, (_, i) => ({
      id: String(i),
      name: `Category ${i}`,
      box_art_url: "",
      igdb_id: null,
    }));
    writeData(categories, outputFile, tmpDir);
    const parsed = JSON.parse(fs.readFileSync(outputFile, "utf8"));
    assert.equal(parsed.meta.total, 5);
  });
});

// ─── lib/api.js — fetchAllCategories ──────────────────────────────────────────────

describe("fetchAllCategories", () => {
  test("returns all categories from a single-page response", async () => {
    const mockGet = async () => ({
      data: [
        { id: "1", name: "Alpha", box_art_url: "" },
        { id: "2", name: "Beta", box_art_url: "" },
      ],
      pagination: {},
    });
    assert.equal(
      (await fetchAllCategories("client-id", "token", mockGet)).length,
      2,
    );
  });

  test("follows pagination cursors until the last page is reached", async () => {
    const pages = [
      {
        data: [{ id: "1", name: "A", box_art_url: "" }],
        pagination: { cursor: "cur1" },
      },
      {
        data: [{ id: "2", name: "B", box_art_url: "" }],
        pagination: { cursor: "cur2" },
      },
      { data: [{ id: "3", name: "C", box_art_url: "" }], pagination: {} },
    ];
    let callCount = 0;
    const mockGet = async () => pages[callCount++];
    const result = await fetchAllCategories("client-id", "token", mockGet);
    assert.equal(result.length, 3);
    assert.equal(callCount, 3, "Should have made exactly 3 requests");
  });

  test('omits the "after" param on the first request and includes it on subsequent ones', async () => {
    const capturedUrls = [];
    const pages = [
      {
        data: [{ id: "1", name: "A", box_art_url: "" }],
        pagination: { cursor: "abc123" },
      },
      { data: [{ id: "2", name: "B", box_art_url: "" }], pagination: {} },
    ];
    let callCount = 0;
    const mockGet = async (url) => {
      capturedUrls.push(url);
      return pages[callCount++];
    };
    await fetchAllCategories("client-id", "token", mockGet);
    assert.ok(
      !capturedUrls[0].includes("after="),
      "First request should not include after param",
    );
    assert.ok(
      capturedUrls[1].includes("after=abc123"),
      "Second request should carry the cursor",
    );
  });

  test("sends the correct Authorization and Client-ID headers on every request", async () => {
    const capturedHeaders = [];
    const mockGet = async (_url, headers) => {
      capturedHeaders.push(headers);
      return { data: [], pagination: {} };
    };
    await fetchAllCategories("my-client-id", "my-token", mockGet);
    assert.equal(capturedHeaders[0]["Client-ID"], "my-client-id");
    assert.equal(capturedHeaders[0]["Authorization"], "Bearer my-token");
  });

  test("returns an empty array when the API returns no categories", async () => {
    const mockGet = async () => ({ data: [], pagination: {} });
    assert.deepEqual(await fetchAllCategories("id", "token", mockGet), []);
  });

  test("handles a response with a missing data field without throwing", async () => {
    const mockGet = async () => ({ pagination: {} });
    assert.deepEqual(await fetchAllCategories("id", "token", mockGet), []);
  });

  test("propagates errors thrown by the injected HTTP function", async () => {
    const mockGet = async () => {
      throw new Error("Network failure");
    };
    await assert.rejects(
      () => fetchAllCategories("id", "token", mockGet),
      /Network failure/,
    );
  });
});
