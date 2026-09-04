export function GET() {
  return Response.json({
    ok: true,
    service: "it's-agro-programacao-embarque",
    routeProvider:
      process.env.ROUTES_API_KEY || process.env.GOOGLE_MAPS_API_KEY
        ? 'configured'
        : 'coordinate-estimate',
    geocodingProvider: process.env.GEOCODING_PROVIDER || 'nominatim',
    mapProvider: process.env.NEXT_PUBLIC_MAP_PROVIDER || 'openstreetmap',
    database: process.env.DATABASE_URL ? 'configured' : 'local-storage',
  });
}
