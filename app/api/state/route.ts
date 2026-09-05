import { randomUUID } from 'node:crypto';
import { hasDatabaseConfigured, withDatabase } from '@/db/server';

export const runtime = 'nodejs';

const SITE_ORIGIN =
  'https://its-agro-programacao-embarque.william-alexandredas.chatgpt.site';
const RENDER_ORIGIN = 'https://its-agro-programacao-embarque.onrender.com';

function actorFrom(request: Request) {
  const cookie = request.headers.get('cookie') || '';
  const match = cookie.match(/(?:^|;\s*)its_agro_actor=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : randomUUID();
}

function corsHeaders(request: Request, extra: Record<string, string> = {}) {
  const origin = request.headers.get('origin') || '';
  const allowed = [
    SITE_ORIGIN,
    RENDER_ORIGIN,
    process.env.NEXT_PUBLIC_APP_URL,
  ].filter(Boolean);
  const headers: Record<string, string> = {
    'Cache-Control': 'no-store',
    Vary: 'Origin',
    ...extra,
  };
  if (allowed.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
    headers['Access-Control-Allow-Headers'] = 'Content-Type, If-Match';
    headers['Access-Control-Allow-Methods'] = 'GET, PUT, OPTIONS';
  }
  return headers;
}

function response(
  request: Request,
  body: unknown,
  status = 200,
  extra: Record<string, string> = {},
) {
  return Response.json(body, { status, headers: corsHeaders(request, extra) });
}

function actorCookie(actorId: string) {
  return `its_agro_actor=${encodeURIComponent(actorId)}; Path=/; Max-Age=31536000; HttpOnly; SameSite=None; Secure`;
}

function validState(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const state = value as Record<string, unknown>;
  return ['people', 'locations', 'schedules'].every((key) =>
    Array.isArray(state[key]),
  );
}

function counts(state: Record<string, unknown>) {
  return {
    people: Array.isArray(state.people) ? state.people.length : 0,
    locations: Array.isArray(state.locations) ? state.locations.length : 0,
    schedules: Array.isArray(state.schedules) ? state.schedules.length : 0,
  };
}

function normalizeRow(row: {
  state: Record<string, unknown>;
  version: string | number;
  updated_at: string;
  last_source: string;
}) {
  return {
    state: row.state,
    version: Number(row.version),
    updatedAt: row.updated_at,
    source: row.last_source,
    counts: counts(row.state),
    pending: 0,
  };
}

export function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export async function GET(request: Request) {
  if (!hasDatabaseConfigured())
    return response(request, { error: 'database_not_configured' }, 503);
  const actorId = actorFrom(request);
  try {
    const result = await withDatabase(actorId, async (client) => {
      const query = await client.query(
        'select state, version, updated_at, last_source from public.app_state where id = 1',
      );
      return normalizeRow(query.rows[0]);
    });
    return response(request, result, 200, {
      ETag: `"v${result.version}"`,
      'Set-Cookie': actorCookie(actorId),
    });
  } catch {
    return response(request, { error: 'database_unavailable' }, 503);
  }
}

export async function PUT(request: Request) {
  if (!hasDatabaseConfigured())
    return response(request, { error: 'database_not_configured' }, 503);
  const actorId = actorFrom(request);
  let body: { state?: unknown; expectedVersion?: number; source?: string };
  try {
    body = (await request.json()) as {
      state?: unknown;
      expectedVersion?: number;
      source?: string;
    };
  } catch {
    return response(request, { error: 'invalid_json' }, 400);
  }
  if (
    !validState(body.state) ||
    !Number.isInteger(body.expectedVersion) ||
    (body.expectedVersion as number) < 1
  ) {
    return response(request, { error: 'invalid_state' }, 400);
  }
  const state = body.state as Record<string, unknown>;
  const source = body.source === 'LOCAL MIGRADO' ? 'LOCAL MIGRADO' : 'ONLINE';
  try {
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
        [
          nextVersion,
          'STATE_SAVED',
          source,
          actorId,
          JSON.stringify(counts(state)),
        ],
      );
      return { conflict: false, current: normalizeRow(updated.rows[0]) };
    });
    if (result.conflict) {
      return response(
        request,
        {
          error: 'conflict',
          message: 'REGISTRO ALTERADO POR OUTRO USUÁRIO',
          ...result.current,
        },
        409,
        {
          ETag: `"v${result.current.version}"`,
          'Set-Cookie': actorCookie(actorId),
        },
      );
    }
    return response(request, result.current, 200, {
      ETag: `"v${result.current.version}"`,
      'Set-Cookie': actorCookie(actorId),
    });
  } catch {
    return response(request, { error: 'database_unavailable' }, 503);
  }
}
