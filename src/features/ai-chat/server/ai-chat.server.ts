import type { Database } from 'bun:sqlite';
import { err, ok } from '@bitclaw/result';
import { randomUUIDv7 } from 'bun';
import { ERROR_CODES } from '@/lib/constants';

export type ConversationRecord = {
  id: string;
  title: string;
  created_at: number;
  updated_at: number | null;
};

export type ChatMessageRecord = {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: number;
};

type ConversationRow = ConversationRecord;
type MessageRow = {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  created_at: number;
};

const toConversation = (row: ConversationRow): ConversationRecord => row;

const toMessage = (row: MessageRow): ChatMessageRecord => ({
  ...row,
  role: row.role as 'user' | 'assistant'
});

export const listConversations = (db: Database): ConversationRecord[] =>
  db
    .query<ConversationRow, []>(
      'SELECT * FROM conversations ORDER BY COALESCE(updated_at, created_at) DESC, id DESC'
    )
    .all()
    .map(toConversation);

export const getMessages = (
  db: Database,
  conversationId: string
): ChatMessageRecord[] =>
  db
    .query<MessageRow, [string]>(
      'SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY created_at ASC'
    )
    .all(conversationId)
    .map(toMessage);

export const getConversationById = (
  db: Database,
  id: string
): ConversationRecord | null => {
  const row = db
    .query<ConversationRow, [string]>(
      'SELECT * FROM conversations WHERE id = ?'
    )
    .get(id);
  return row ? toConversation(row) : null;
};

export const insertConversation = (
  db: Database,
  input: { title: string }
): ConversationRecord => {
  const now = Date.now();
  const id = randomUUIDv7();
  db.run(
    'INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
    [id, input.title.trim(), now, null]
  );
  return { id, title: input.title.trim(), created_at: now, updated_at: null };
};

export const insertMessage = (
  db: Database,
  input: {
    id: string;
    conversationId: string;
    role: 'user' | 'assistant';
    content: string;
  }
): ChatMessageRecord | null => {
  const existing = db
    .query<{ id: string }, [string]>(
      'SELECT id FROM conversations WHERE id = ?'
    )
    .get(input.conversationId);
  if (!existing) return null;

  const now = Date.now();
  db.run(
    'INSERT INTO chat_messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
    [input.id, input.conversationId, input.role, input.content, now]
  );
  db.run('UPDATE conversations SET updated_at = ? WHERE id = ?', [
    now,
    input.conversationId
  ]);
  return {
    id: input.id,
    conversation_id: input.conversationId,
    role: input.role,
    content: input.content,
    created_at: now
  };
};

export const deleteConversation = (db: Database, id: string) => {
  const existing = db
    .query<{ id: string }, [string]>(
      'SELECT id FROM conversations WHERE id = ?'
    )
    .get(id);
  if (!existing) return err(ERROR_CODES.NOT_FOUND, 'Conversation not found.');
  db.run('DELETE FROM conversations WHERE id = ?', [id]);
  return ok({ deleted: true });
};

export const updateConversationTitle = (
  db: Database,
  id: string,
  title: string
): number => {
  const { changes } = db
    .query('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?')
    .run(title.trim(), Date.now(), id);
  return changes;
};
