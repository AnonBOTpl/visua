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
  CREATE INDEX IF NOT EXISTS idx_seen_session ON seen_images(session_id)
`);

export async function markSeen(sessionId: string, urls: string[]): Promise<void> {
  if (!urls.length) return;
  for (const url of urls) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO seen_images (session_id, image_url) VALUES (?, ?)`,
      args: [sessionId, url],
    });
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

// Auto-cleanup: remove entries older than 30 days
await db.execute(`
  DELETE FROM seen_images WHERE seen_at < unixepoch() - 2592000
`);
