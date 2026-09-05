import type { PersistedState } from './storage';

const RENDER_API_ORIGIN = 'https://its-agro-programacao-embarque.onrender.com';

export type CloudStateResponse = {
  state: PersistedState;
  version: number;
  updatedAt: string;
  source: string;
  counts: { people: number; locations: number; schedules: number };
  pending: number;
};

export class CloudConflictError extends Error {
  remote: CloudStateResponse;

  constructor(remote: CloudStateResponse) {
    super('REGISTRO ALTERADO POR OUTRO USUÁRIO');
    this.name = 'CloudConflictError';
    this.remote = remote;
  }
}

function apiOrigin() {
  if (typeof window === 'undefined') return RENDER_API_ORIGIN;
  const configured = process.env.NEXT_PUBLIC_DATA_API_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  if (window.location.hostname.endsWith('onrender.com'))
    return window.location.origin;
  return RENDER_API_ORIGIN;
}

async function request(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');
  return fetch(`${apiOrigin()}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  });
}

export async function fetchCloudState() {
  const response = await request('/api/state');
  const payload = (await response.json()) as CloudStateResponse & {
    error?: string;
  };
  if (!response.ok) throw new Error(payload.error || 'database_unavailable');
  return payload;
}

export async function saveCloudState(
  state: PersistedState,
  expectedVersion: number,
  source: 'ONLINE' | 'LOCAL MIGRADO' = 'ONLINE',
) {
  const response = await request('/api/state', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'If-Match': `"v${expectedVersion}"`,
    },
    body: JSON.stringify({ state, expectedVersion, source }),
  });
  const payload = (await response.json()) as CloudStateResponse & {
    error?: string;
    message?: string;
  };
  if (response.status === 409) throw new CloudConflictError(payload);
  if (!response.ok) throw new Error(payload.error || 'database_unavailable');
  return payload;
}

export function mergePersistedStates(
  remote: PersistedState,
  local: PersistedState,
): PersistedState {
  const merge = (first: unknown[] = [], second: unknown[] = []) => {
    const result = new Map<string, unknown>();
    [...first, ...second].forEach((item, index) => {
      const record =
        item && typeof item === 'object'
          ? (item as Record<string, unknown>)
          : {};
      const id =
        typeof record.id === 'string' || typeof record.id === 'number'
          ? String(record.id)
          : `legacy-${index}`;
      result.set(id, item);
    });
    return [...result.values()];
  };
  return {
    people: merge(remote.people, local.people),
    locations: merge(remote.locations, local.locations),
    schedules: merge(remote.schedules, local.schedules),
    dailyPlans: merge(remote.dailyPlans, local.dailyPlans),
    suggestions: merge(remote.suggestions, local.suggestions),
    feedbacks: merge(remote.feedbacks, local.feedbacks),
    costPerKm: local.costPerKm ?? remote.costPerKm ?? 1.2,
  };
}
