export const STORAGE_KEY = 'its-agro-programacao-embarque-v1';

export type PersistedState = {
  people: unknown[];
  locations: unknown[];
  schedules: unknown[];
  dailyPlans?: unknown[];
  suggestions?: unknown[];
  feedbacks?: unknown[];
  costPerKm?: number;
  source?: 'ONLINE' | 'LOCAL MIGRADO';
};

export function readPersistedState(): PersistedState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedState) : null;
  } catch {
    return null;
  }
}

export function writePersistedState(state: PersistedState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function isDevelopmentSeedAllowed() {
  return (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );
}
