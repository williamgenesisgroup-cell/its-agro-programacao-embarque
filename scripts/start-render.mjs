import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const port = Number(process.env.PORT || 8787);
const staticRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../dist/render-client',
);
const siteOrigin =
  'https://its-agro-programacao-embarque.william-alexandredas.chatgpt.site';
const renderOrigin = 'https://its-agro-programacao-embarque.onrender.com';

const migration = `
create extension if not exists pgcrypto;

create table if not exists public.app_state (
  id integer primary key,
  state jsonb not null,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  updated_by text not null default 'web-app',
  last_source text not null default 'ONLINE'
);

create table if not exists public.app_state_audit (
  id bigserial primary key,
  state_version bigint not null,
  action text not null,
  source text not null,
  actor_id text,
  entity_counts jsonb not null default '{}'::jsonb,
  changed_at timestamptz not null default now()
);

create table if not exists public.settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.app_state (id, state, version, updated_by, last_source)
values (
  1,
  jsonb_build_object(
    'people', '[]'::jsonb,
    'locations', '[]'::jsonb,
    'schedules', '[]'::jsonb,
    'dailyPlans', '[]'::jsonb,
    'suggestions', '[]'::jsonb,
    'costPerKm', 1.2
  ),
  1,
  'database-bootstrap',
  'ONLINE'
)
on conflict (id) do nothing;

alter table public.app_state enable row level security;
alter table public.app_state force row level security;
alter table public.app_state_audit enable row level security;
alter table public.app_state_audit force row level security;
alter table public.settings enable row level security;
alter table public.settings force row level security;

drop policy if exists app_state_api_access on public.app_state;
create policy app_state_api_access on public.app_state
  for all
  using (current_setting('app.access_granted', true) = 'true')
  with check (current_setting('app.access_granted', true) = 'true');

drop policy if exists app_state_audit_api_access on public.app_state_audit;
create policy app_state_audit_api_access on public.app_state_audit
  for all
  using (current_setting('app.access_granted', true) = 'true')
  with check (current_setting('app.access_granted', true) = 'true');

drop policy if exists settings_api_access on public.settings;
create policy settings_api_access on public.settings
  for all
  using (current_setting('app.access_granted', true) = 'true')
  with check (current_setting('app.access_granted', true) = 'true');
`;

const databaseUrl = process.env.DATABASE_URL || '';
const databaseSsl =
  process.env.DATABASE_SSL === 'true' ||
  /(?:^|\.)render\.com(?::|\/|$)/i.test(databaseUrl);

const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      max: Number(process.env.DATABASE_POOL_MAX || 5),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: databaseSsl ? { rejectUnauthorized: false } : undefined,
    })
  : null;

let migrationPromise;
const ensureDatabase = async () => {
  if (!pool) throw new Error('DATABASE_URL não configurada');
  if (!migrationPromise) {
    migrationPromise = pool
      .query(migration)
      .then(() => undefined)
      .catch((error) => {
        migrationPromise = undefined;
        throw error;
      });
  }
  await migrationPromise;
};

const actorFrom = (request) => {
  const cookie = request.headers.cookie || '';
  const match = cookie.match(/(?:^|;\s*)its_agro_actor=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : randomUUID();
};

const validState = (value) =>
  value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  ['people', 'locations', 'schedules'].every((key) =>
    Array.isArray(value[key]),
  );

const counts = (state) => ({
  people: Array.isArray(state.people) ? state.people.length : 0,
  locations: Array.isArray(state.locations) ? state.locations.length : 0,
  schedules: Array.isArray(state.schedules) ? state.schedules.length : 0,
});

const normalizeRow = (row) => ({
  state: row.state,
  version: Number(row.version),
  updatedAt: row.updated_at,
  source: row.last_source,
  counts: counts(row.state),
  pending: 0,
});

const responseHeaders = (request, extra = {}) => {
  const origin = request.headers.origin || '';
  const allowed = [siteOrigin, renderOrigin, process.env.NEXT_PUBLIC_APP_URL].filter(
    Boolean,
  );
  const headers = {
    'cache-control': 'no-store',
    vary: 'Origin',
    ...extra,
  };
  if (allowed.includes(origin)) {
    headers['access-control-allow-origin'] = origin;
    headers['access-control-allow-credentials'] = 'true';
    headers['access-control-allow-headers'] = 'Content-Type, If-Match';
    headers['access-control-allow-methods'] = 'GET, PUT, OPTIONS';
  }
  return headers;
};

const sendJson = (request, response, body, status = 200, extra = {}) => {
  const payload = Buffer.from(JSON.stringify(body));
  response.writeHead(status, {
    ...responseHeaders(request, extra),
    'content-type': 'application/json; charset=utf-8',
    'content-length': payload.length,
  });
  response.end(payload);
};

const setActorCookie = (actorId) =>
  `its_agro_actor=${encodeURIComponent(actorId)}; Path=/; Max-Age=31536000; HttpOnly; SameSite=None; Secure`;

const withDatabase = async (actorId, work) => {
  await ensureDatabase();
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query("select set_config('app.access_granted', 'true', true)");
    await client.query("select set_config('app.actor_id', $1, true)", [actorId]);
    const result = await work(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
};

const readBody = async (request) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
};

const handleApi = async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host}`);
  if (!url.pathname.startsWith('/api/')) return false;

  if (url.pathname === '/api/health' && request.method === 'GET') {
    let database = 'not-configured';
    let databaseVersion = null;
    if (pool) {
      try {
        const result = await withDatabase('health-check', (client) =>
          client.query('select version from public.app_state where id = 1'),
        );
        database = 'online';
        databaseVersion = Number(result.rows[0]?.version || 0);
      } catch {
        database = 'error';
      }
    }
    sendJson(request, response, {
      ok: true,
      service: "it's-agro-programacao-embarque",
      routeProvider:
        process.env.ROUTES_API_KEY || process.env.GOOGLE_MAPS_API_KEY
          ? 'configured'
          : 'coordinate-estimate',
      geocodingProvider: process.env.GEOCODING_PROVIDER || 'nominatim',
      mapProvider: process.env.NEXT_PUBLIC_MAP_PROVIDER || 'openstreetmap',
      database,
      databaseVersion,
    });
    return true;
  }

  if (url.pathname !== '/api/state' || !['GET', 'PUT', 'OPTIONS'].includes(request.method)) {
    sendJson(request, response, { error: 'not_found' }, 404);
    return true;
  }
  if (request.method === 'OPTIONS') {
    response.writeHead(204, responseHeaders(request));
    response.end();
    return true;
  }
  if (!pool) {
    sendJson(request, response, { error: 'database_not_configured' }, 503);
    return true;
  }

  const actorId = actorFrom(request);
  try {
    if (request.method === 'GET') {
      const result = await withDatabase(actorId, async (client) => {
        const query = await client.query(
          'select state, version, updated_at, last_source from public.app_state where id = 1',
        );
        return normalizeRow(query.rows[0]);
      });
      sendJson(request, response, result, 200, {
        etag: `"v${result.version}"`,
        'set-cookie': setActorCookie(actorId),
      });
      return true;
    }

    let body;
    try {
      body = JSON.parse(await readBody(request));
    } catch {
      sendJson(request, response, { error: 'invalid_json' }, 400);
      return true;
    }
    if (!validState(body.state) || !Number.isInteger(body.expectedVersion) || body.expectedVersion < 1) {
      sendJson(request, response, { error: 'invalid_state' }, 400);
      return true;
    }
    const state = body.state;
    const source = body.source === 'LOCAL MIGRADO' ? 'LOCAL MIGRADO' : 'ONLINE';
    const result = await withDatabase(actorId, async (client) => {
      const currentQuery = await client.query(
        'select state, version, updated_at, last_source from public.app_state where id = 1 for update',
      );
      const current = currentQuery.rows[0];
      if (Number(current.version) !== body.expectedVersion) {
        return { conflict: true, current: normalizeRow(current) };
      }
      const nextVersion = Number(current.version) + 1;
      const updated = await client.query(
        `update public.app_state
           set state = $1::jsonb, version = $2, updated_at = now(), updated_by = $3, last_source = $4
         where id = 1
         returning state, version, updated_at, last_source`,
        [JSON.stringify(state), nextVersion, actorId, source],
      );
      await client.query(
        `insert into public.app_state_audit (state_version, action, source, actor_id, entity_counts)
         values ($1, $2, $3, $4, $5::jsonb)`,
        [nextVersion, 'STATE_SAVED', source, actorId, JSON.stringify(counts(state))],
      );
      return { conflict: false, current: normalizeRow(updated.rows[0]) };
    });
    const extra = {
      etag: `"v${result.current.version}"`,
      'set-cookie': setActorCookie(actorId),
    };
    if (result.conflict) {
      sendJson(
        request,
        response,
        {
          error: 'conflict',
          message: 'REGISTRO ALTERADO POR OUTRO USUÁRIO',
          ...result.current,
        },
        409,
        extra,
      );
    } else sendJson(request, response, result.current, 200, extra);
    return true;
  } catch {
    sendJson(request, response, { error: 'database_unavailable' }, 503);
    return true;
  }
};

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

const isWithinStaticRoot = (filePath) =>
  filePath === staticRoot || filePath.startsWith(`${staticRoot}${path.sep}`);

const serveStatic = async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host}`);
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    response.writeHead(400);
    response.end('Bad Request');
    return;
  }

  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  const filePath = path.resolve(staticRoot, `.${requestedPath}`);
  const hasAssetExtension = path.extname(requestedPath) !== '';
  let resolvedPath = filePath;
  try {
    if (!isWithinStaticRoot(filePath)) throw new Error('invalid path');
    const fileInfo = await stat(filePath);
    if (!fileInfo.isFile()) throw new Error('not a file');
  } catch {
    if (hasAssetExtension || pathname.startsWith('/_next/')) {
      response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('Not Found');
      return;
    }
    resolvedPath = path.join(staticRoot, 'index.html');
  }

  const payload = await readFile(resolvedPath);
  const extension = path.extname(resolvedPath).toLowerCase();
  response.writeHead(200, {
    'content-type': mimeTypes[extension] || 'application/octet-stream',
    'cache-control': extension === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
  });
  if (request.method !== 'HEAD') response.end(payload);
  else response.end();
};

const server = createServer(async (request, response) => {
  try {
    if (!(await handleApi(request, response))) await serveStatic(request, response);
  } catch (error) {
    console.error('[render-gateway] request failed', error);
    if (!response.headersSent) response.writeHead(502);
    response.end('Bad Gateway');
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`[render-gateway] listening on ${port}; static app at ${staticRoot}`);
});

const shutdown = async () => {
  server.close();
  await pool?.end().catch(() => undefined);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
