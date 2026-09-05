import { Pool, type PoolClient } from 'pg';
import { RENDER_SHARED_STATE_MIGRATION } from './runtime-migration';

let pool: Pool | null = null;
let migrationPromise: Promise<void> | null = null;

function databaseUrl() {
  return process.env.DATABASE_URL?.trim() || '';
}

export function hasDatabaseConfigured() {
  return Boolean(databaseUrl());
}

function getPool() {
  const connectionString = databaseUrl();
  if (!connectionString) throw new Error('DATABASE_URL não configurada');
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: Number(process.env.DATABASE_POOL_MAX || 5),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl:
        process.env.DATABASE_SSL === 'true'
          ? { rejectUnauthorized: false }
          : undefined,
    });
  }
  return pool;
}

export async function ensureDatabase() {
  if (!migrationPromise) {
    migrationPromise = (async () => {
      const client = await getPool().connect();
      try {
        await client.query(RENDER_SHARED_STATE_MIGRATION);
      } finally {
        client.release();
      }
    })().catch((error) => {
      migrationPromise = null;
      throw error;
    });
  }
  await migrationPromise;
}

export async function withDatabase<T>(
  actorId: string,
  work: (client: PoolClient) => Promise<T>,
) {
  await ensureDatabase();
  const client = await getPool().connect();
  try {
    await client.query('begin');
    await client.query("select set_config('app.access_granted', 'true', true)");
    await client.query("select set_config('app.actor_id', $1, true)", [
      actorId,
    ]);
    const result = await work(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDatabase() {
  if (pool) {
    await pool.end();
    pool = null;
    migrationPromise = null;
  }
}
