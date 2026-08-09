import type { Database } from 'bun:sqlite';

export const migration = {
  id: '004_add_conversations',
  run: (db: Database) => {
    db.run(`
      CREATE TABLE IF NOT EXISTS conversations (
        id         TEXT PRIMARY KEY,
        title      TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER
      )
    `);
    db.run(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id              TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        role            TEXT NOT NULL,
        content         TEXT NOT NULL,
        created_at      INTEGER NOT NULL
      )
    `);
    db.run(
      'CREATE INDEX IF NOT EXISTS idx_chat_messages_conv ON chat_messages(conversation_id, created_at)'
    );
  }
};
