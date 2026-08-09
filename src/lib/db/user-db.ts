import type { Database } from 'bun:sqlite';
import path from 'node:path';
import { createTenantDbManager } from '@bitclaw/sqlite/tenant-db';
import { sqlLog } from './sql-logger';
import { runUserMigrations } from './user-migrations';

const formatSql = (sql: string) => sql.replace(/\s+/g, ' ').trim();

const wrapWithSqlLog = (raw: Database, label: string): Database => {
  if (!sqlLog.isLevelEnabled('debug')) return raw;
  return new Proxy(raw, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') return value;
      if (prop === 'query' || prop === 'prepare') {
        return (sql: string) => {
          sqlLog.debug({ label }, formatSql(sql));
          return (value as (sql: string) => unknown).call(target, sql);
        };
      }
      if (prop === 'run') {
        return (sql: string, ...params: unknown[]) => {
          sqlLog.debug({ label, params }, formatSql(sql));
          return (value as (sql: string, ...p: unknown[]) => unknown).call(
            target,
            sql,
            ...params
          );
        };
      }
      if (prop === 'exec') {
        return (sql: string) => {
          sqlLog.debug({ label }, formatSql(sql));
          return (value as (sql: string) => unknown).call(target, sql);
        };
      }
      return value.bind(target);
    }
  });
};

// Resolve fresh each call , tests may change USER_DATA_DIR/RUNMIST_DATA_DIR
// between cases. RUNMIST_DATA_DIR (set automatically when deployed through
// Runmist) takes priority when present - it's the platform's persistent,
// sandbox-correct writable root. Falls back to USER_DATA_DIR (self-hosted
// convention) or the repo-relative default when neither is set - zero
// behavior change for self-hosters who never set RUNMIST_DATA_DIR.
export const getUserDbPath = (userId: string): string => {
  const dataDir = path.resolve(
    process.env.RUNMIST_DATA_DIR
      ? path.join(process.env.RUNMIST_DATA_DIR, 'users')
      : (process.env.USER_DATA_DIR ?? path.join('data', 'users'))
  );
  const resolved = path.resolve(dataDir, userId, 'user.db');
  if (!resolved.startsWith(dataDir + path.sep)) {
    throw new Error('Invalid userId: path traversal detected');
  }
  return resolved;
};

const manager = createTenantDbManager({
  onOpen: db => runUserMigrations(db),
  wrapDb: (raw, userId) => wrapWithSqlLog(raw, `user:${userId.slice(0, 8)}`)
});

export const getUserDb = (userId: string): Database =>
  manager.getDb(userId, getUserDbPath(userId));

export const withWriteLock = manager.withWriteLock;
export const closeUserDb = manager.evict;
export const evictIdleConnections = manager.evictIdle;
export const closeAllUserDbs = manager.closeAll;
