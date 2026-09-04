export function GET() {
  return Response.json({
    ok: true,
    service: "it's-agro-programacao-embarque",
    routeProvider: process.env.GOOGLE_MAPS_API_KEY ? 'configured' : 'coordinate-estimate',
    database: process.env.DATABASE_URL ? 'configured' : 'local-storage',
  });
}
