import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { db } from '@/lib/db/index.ts';

migrate(db, { migrationsFolder: './drizzle' });
console.info('Migrations applied.');
