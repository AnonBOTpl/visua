/**
 * Lightweight persistence using @libsql/client (file-based SQLite, pure JS).
 * Used for storing "seen" image URLs per session.
 */
import { createClient } from "@libsql/client";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH ?? path.join(__dirname, "..", "data", "visua.db");

// Ensure data directory exists
import fs from "fs";
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = createClient({ url: `file:${DB_PATH}` });

// Initialize schema
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

await db.execute(`
  CREATE INDEX IF NOT EXISTS idx_seen_session ON seen_images(session_id)
`);

await db.execute(`
  CREATE INDEX IF NOT EXISTS idx_fav_session ON favorites(session_id)
`);

export async function markSeen(sessionId: string, urls: string[]): Promise<void> {
  if (!urls.length) return;

  // Use a transaction for better performance with multiple URLs
  const statements = urls.map(url => ({
    sql: `INSERT OR IGNORE INTO seen_images (session_id, image_url) VALUES (?, ?)`,
    args: [sessionId, url],
  }));

  try {
    await db.batch(statements);
  } catch (err) {
    console.error("[db] batch insert failed, falling back to sequential", err);
    for (const url of urls) {
      await db.execute({
        sql: `INSERT OR IGNORE INTO seen_images (session_id, image_url) VALUES (?, ?)`,
        args: [sessionId, url],
      });
    }
  }
}

export async function getSeenUrls(sessionId: string): Promise<Set<string>> {
  const result = await db.execute({
    sql: `SELECT image_url FROM seen_images WHERE session_id = ?`,
    args: [sessionId],
  });
  return new Set(result.rows.map((r) => r[0] as string));
}

export async function clearSeen(sessionId: string): Promise<void> {
  await db.execute({
    sql: `DELETE FROM seen_images WHERE session_id = ?`,
    args: [sessionId],
  });
}

export async function addFavorite(sessionId: string, image: any): Promise<void> {
  try {
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
  } catch (err) {
    console.error("[db] addFavorite failed:", err);
    throw err;
  }
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

// Auto-cleanup: remove entries older than 30 days
await db.execute(`
  DELETE FROM seen_images WHERE seen_at < unixepoch() - 2592000
`);
