import { hasDatabaseConfigured, withDatabase } from '@/db/server';

export async function GET() {
  let database: 'online' | 'not-configured' | 'error' = 'not-configured';
  let databaseVersion: number | null = null;
  if (hasDatabaseConfigured()) {
    try {
      const result = await withDatabase('health-check', async (client) =>
        client.query('select version from public.app_state where id = 1'),
      );
      database = 'online';
      databaseVersion = Number(result.rows[0]?.version || 0);
    } catch {
      database = 'error';
    }
  }
  return Response.json({
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
}
