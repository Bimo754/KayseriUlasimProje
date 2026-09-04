import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { Config } from '../config';

let activeDb: Database.Database | null = null;

export function getDb(dbPath?: string): Database.Database {
  const targetPath = dbPath || Config.DB_PATH;
  if (activeDb && activeDb.name === targetPath && activeDb.open) {
    return activeDb;
  }
  const dir = path.dirname(targetPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const db = new Database(targetPath);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');

  if (!dbPath) {
    activeDb = db;
  }
  return db;
}
