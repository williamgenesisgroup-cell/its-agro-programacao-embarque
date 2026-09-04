export type GeocodingSuggestion = {
  displayName: string;
  lat: number;
  lng: number;
  type?: string;
};

export function buildAddressQuery(input: {
  address?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  uf?: string;
  cep?: string;
}) {
  return [
    [input.address, input.number].filter(Boolean).join(', '),
    input.neighborhood,
    input.city,
    input.uf,
    input.cep,
    'Brasil',
  ]
    .filter(Boolean)
    .join(', ');
}

export async function geocodeWithNominatim(
  query: string,
  signal?: AbortSignal,
) {
  if (!query.trim()) return [] as GeocodingSuggestion[];
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '5');
  url.searchParams.set('countrycodes', 'br');
  url.searchParams.set('q', query);
  const response = await fetch(url, {
    signal,
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('Falha na geocodificação');
  const data = (await response.json()) as Array<{
    display_name: string;
    lat: string;
    lon: string;
    type?: string;
  }>;
  return data
    .map((item) => ({
      displayName: item.display_name,
      lat: Number(item.lat),
      lng: Number(item.lon),
      type: item.type,
    }))
    .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
}
