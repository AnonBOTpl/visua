/**
 * Lightweight persistence using @libsql/client (file-based SQLite, pure JS).
 */
import { createClient } from "@libsql/client";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, "..", "data", "visua.db");

// Ensure data directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = createClient({ url: `file:${DB_PATH}` });

// Initialize schema
await db.execute(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )
`);

await db.execute(`
  CREATE TABLE IF NOT EXISTS seen_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    image_url TEXT NOT NULL,
    seen_at INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(session_id, image_url)
  )
`);

await db.execute(`
  CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    title TEXT,
    thumbnail_url TEXT NOT NULL,
    source_url TEXT,
    original_url TEXT,
    source_domain TEXT,
    width INTEGER,
    height INTEGER,
    saved_at INTEGER NOT NULL DEFAULT (unixepoch()),
    UNIQUE(session_id, thumbnail_url)
  )
`);

await db.execute(`CREATE INDEX IF NOT EXISTS idx_seen_session ON seen_images(session_id)`);
await db.execute(`CREATE INDEX IF NOT EXISTS idx_fav_session ON favorites(session_id)`);

// Default settings
const defaultSettings = [
  { key: "safesearch", value: "active" },
  { key: "default_image_type", value: "all" },
  { key: "default_image_size", value: "all" },
  { key: "search_lang", value: "en" },
  { key: "search_country", value: "ALL" },
  { key: "theme", value: "dark" },
  { key: "grid_columns", value: "auto" },
  { key: "seen_mode", value: "dim" },
  { key: "brave_api_key", value: "" },
  { key: "brave_enabled", value: "false" },
  { key: "serpapi_key", value: "" },
  { key: "serpapi_enabled", value: "false" },
];

for (const setting of defaultSettings) {
  await db.execute({
    sql: `INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)`,
    args: [setting.key, setting.value],
  });
}

// Settings logic
export async function getSettings(): Promise<Record<string, string>> {
  const result = await db.execute("SELECT key, value FROM settings");
  const settings: Record<string, string> = {};
  result.rows.forEach(row => {
    settings[row.key as string] = row.value as string;
  });
  return settings;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.execute({
    sql: `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
    args: [key, value],
  });
}

export async function setManySettings(settings: { key: string, value: string }[]): Promise<void> {
  const statements = settings.map(s => ({
    sql: `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
    args: [s.key, s.value],
  }));
  await db.batch(statements);
}

// Seen images logic
export async function markSeen(sessionId: string, urls: string[]): Promise<void> {
  if (!urls.length) return;
  const statements = urls.map(url => ({
    sql: `INSERT OR IGNORE INTO seen_images (session_id, image_url) VALUES (?, ?)`,
    args: [sessionId, url],
  }));
  await db.batch(statements);
}

export async function getSeenUrls(sessionId: string): Promise<Set<string>> {
  const result = await db.execute({
    sql: `SELECT image_url FROM seen_images WHERE session_id = ?`,
    args: [sessionId],
  });
  return new Set(result.rows.map((r) => r.image_url as string));
}

export async function clearSeen(sessionId: string): Promise<void> {
  await db.execute({
    sql: `DELETE FROM seen_images WHERE session_id = ?`,
    args: [sessionId],
  });
}

// Favorites logic
export async function addFavorite(sessionId: string, image: any): Promise<void> {
  await db.execute({
    sql: `INSERT OR IGNORE INTO favorites (session_id, title, thumbnail_url, source_url, original_url, source_domain, width, height)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      sessionId,
      image.title || null,
      image.thumbnailUrl,
      image.sourceUrl || null,
      image.originalUrl || null,
      image.sourceDomain || null,
      image.width || null,
      image.height || null
    ],
  });
}

export async function removeFavorite(sessionId: string, thumbnailUrl: string): Promise<void> {
  await db.execute({
    sql: `DELETE FROM favorites WHERE session_id = ? AND thumbnail_url = ?`,
    args: [sessionId, thumbnailUrl],
  });
}

export async function getFavorites(sessionId: string): Promise<any[]> {
  const result = await db.execute({
    sql: `SELECT title, thumbnail_url, source_url, original_url, source_domain, width, height FROM favorites WHERE session_id = ? ORDER BY saved_at DESC`,
    args: [sessionId],
  });
  return result.rows.map(r => ({
    title: r.title as string,
    thumbnailUrl: r.thumbnail_url as string,
    sourceUrl: r.source_url as string,
    originalUrl: r.original_url as string,
    sourceDomain: r.source_domain as string,
    width: r.width as number,
    height: r.height as number,
  }));
}

export async function clearFavorites(sessionId: string): Promise<void> {
  await db.execute({
    sql: `DELETE FROM favorites WHERE session_id = ?`,
    args: [sessionId],
  });
}

// Auto-cleanup: remove entries older than 30 days
await db.execute(`DELETE FROM seen_images WHERE seen_at < unixepoch() - 2592000`);
