export type RoutePoint = {
  id: string;
  label: string;
  address: string;
  city: string;
  phone?: string;
  lat?: number;
  lng?: number;
};

export type RouteStop = RoutePoint & {
  order: number;
  distanceKm: number | null;
  durationMin: number | null;
  pickupTime: string | null;
};

export type RouteCalculationMode = 'estimate' | 'real';
export type RouteConfidence = 'high' | 'medium' | 'low';
export type RouteLeg = {
  distanceKm: number;
  durationMin: number;
};
export type RouteLegCalculator = (
  from: RoutePoint,
  to: RoutePoint,
) => RouteLeg | null;

export type RoutePlan = {
  stops: RouteStop[];
  totalKm: number | null;
  totalMinutes: number | null;
  arrivalTime: string | null;
  isApproximate: boolean;
  calculationMode: RouteCalculationMode;
  confidence: RouteConfidence;
  notice: string;
};

const EARTH_RADIUS_KM = 6371;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function haversineKm(a: RoutePoint, b: RoutePoint) {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null)
    return null;
  const latitude = toRadians(b.lat - a.lat);
  const longitude = toRadians(b.lng - a.lng);
  const value =
    Math.sin(latitude / 2) ** 2 +
    Math.cos(toRadians(a.lat)) *
      Math.cos(toRadians(b.lat)) *
      Math.sin(longitude / 2) ** 2;
  return (
    EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
  );
}

export function estimateLeg(a: RoutePoint, b: RoutePoint): RouteLeg | null {
  const straightLineKm = haversineKm(a, b);
  if (straightLineKm == null) return null;
  const distanceKm = Math.max(0.4, straightLineKm * 1.28);
  const durationMin = Math.max(4, Math.round((distanceKm / 48) * 60));
  return { distanceKm, durationMin };
}

function scoreOrder(
  order: RoutePoint[],
  destination: RoutePoint,
  calculateLeg: RouteLegCalculator,
) {
  let total = 0;
  for (let index = 0; index < order.length; index += 1) {
    const leg = calculateLeg(order[index], order[index + 1] ?? destination);
    if (!leg) return Number.POSITIVE_INFINITY;
    total += leg.distanceKm;
  }
  return total;
}

function permutations(points: RoutePoint[], limit = 7) {
  if (points.length > limit) return null;
  const result: RoutePoint[][] = [];
  const walk = (remaining: RoutePoint[], current: RoutePoint[]) => {
    if (!remaining.length) return void result.push(current);
    remaining.forEach((point, index) =>
      walk(
        remaining.filter((_, itemIndex) => itemIndex !== index),
        [...current, point],
      ),
    );
  };
  walk(points, []);
  return result;
}

export function optimizeOrder(
  points: RoutePoint[],
  destination: RoutePoint,
  calculateLeg: RouteLegCalculator = estimateLeg,
) {
  const ready =
    points.every((point) => point.lat != null && point.lng != null) &&
    destination.lat != null &&
    destination.lng != null;
  if (!points.length || !ready) return points;
  const candidates = permutations(points);
  if (candidates)
    return candidates.reduce((best, candidate) =>
      scoreOrder(candidate, destination, calculateLeg) <
      scoreOrder(best, destination, calculateLeg)
        ? candidate
        : best,
    );

  const remaining = [...points];
  const ordered: RoutePoint[] = [];
  let current = remaining.shift();
  while (current) {
    ordered.push(current);
    if (!remaining.length) break;
    const nextIndex = remaining.reduce((bestIndex, point, index) => {
      const best = calculateLeg(current as RoutePoint, remaining[bestIndex]);
      const candidate = calculateLeg(current as RoutePoint, point);
      return candidate && (!best || candidate.durationMin < best.durationMin)
        ? index
        : bestIndex;
    }, 0);
    current = remaining.splice(nextIndex, 1)[0];
  }
  return ordered;
}

function parseTime(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

function formatTime(totalMinutes: number) {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, '0')}:${String(normalized % 60).padStart(2, '0')}`;
}

export function buildRoutePlan({
  points,
  destination,
  departureTime,
  arrivalLeadMinutes,
  stopBufferMinutes,
  orderedIds,
  calculationMode = 'estimate',
  realRouteCalculator,
}: {
  points: RoutePoint[];
  destination: RoutePoint;
  departureTime: string;
  arrivalLeadMinutes: number;
  stopBufferMinutes: number;
  orderedIds?: string[];
  calculationMode?: RouteCalculationMode;
  realRouteCalculator?: RouteLegCalculator;
}): RoutePlan {
  const calculateLeg: RouteLegCalculator =
    calculationMode === 'real' && realRouteCalculator
      ? realRouteCalculator
      : estimateLeg;
  let effectiveMode: RouteCalculationMode =
    calculationMode === 'real' && realRouteCalculator ? 'real' : 'estimate';
  const ordered = orderedIds
    ? orderedIds
        .map((id) => points.find((point) => point.id === id))
        .filter((point): point is RoutePoint => Boolean(point))
    : optimizeOrder(points, destination, calculateLeg);
  const ready =
    ordered.every((point) => point.lat != null && point.lng != null) &&
    destination.lat != null &&
    destination.lng != null;
  if (!ready)
    return {
      stops: ordered.map((point, index) => ({
        ...point,
        order: index + 1,
        distanceKm: null,
        durationMin: null,
        pickupTime: null,
      })),
      totalKm: null,
      totalMinutes: null,
      arrivalTime: null,
      isApproximate: effectiveMode !== 'real',
      calculationMode: effectiveMode,
      confidence: 'low',
      notice: `${effectiveMode === 'real' ? 'ROTA REAL' : 'ESTIMATIVA RÁPIDA'}: informe latitude e longitude para calcular a rota. O endereço ainda não foi localizado por um provedor de mapas.`,
    };

  let legs = ordered.map((point, index) =>
    calculateLeg(point, ordered[index + 1] ?? destination),
  );
  const realProviderFailed =
    effectiveMode === 'real' && legs.some((leg) => leg == null);
  if (realProviderFailed) {
    effectiveMode = 'estimate';
    legs = ordered.map((point, index) =>
      estimateLeg(point, ordered[index + 1] ?? destination),
    );
  }
  const totalKm = legs.reduce(
    (total, leg) => total + (leg?.distanceKm ?? 0),
    0,
  );
  const totalMinutes = legs.reduce(
    (total, leg) => total + (leg?.durationMin ?? 0),
    0,
  );
  const arrival = parseTime(departureTime) - arrivalLeadMinutes;
  let current = arrival;
  const pickupTimes = Array.from<string>({ length: ordered.length });
  for (let index = ordered.length - 1; index >= 0; index -= 1) {
    current -= (legs[index]?.durationMin ?? 0) + stopBufferMinutes;
    pickupTimes[index] = formatTime(current);
  }
  return {
    stops: ordered.map((point, index) => ({
      ...point,
      order: index + 1,
      distanceKm: legs[index]?.distanceKm ?? 0,
      durationMin: legs[index]?.durationMin ?? 0,
      pickupTime: pickupTimes[index],
    })),
    totalKm,
    totalMinutes,
    arrivalTime: formatTime(arrival),
    isApproximate: effectiveMode !== 'real',
    calculationMode: effectiveMode,
    confidence: effectiveMode === 'real' ? 'high' : 'medium',
    notice:
      effectiveMode === 'real'
        ? 'ROTA REAL: distâncias e tempos calculados pelo provedor rodoviário configurado.'
        : `${realProviderFailed ? 'ESTIMATIVA RÁPIDA: o provedor rodoviário não retornou todas as pernas; ' : 'ESTIMATIVA RÁPIDA: '}planejamento por coordenadas. Configure um provedor rodoviário para distâncias e tempos reais.`,
  };
}

export function formatDuration(minutes: number | null) {
  if (minutes == null) return '—';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h${String(rest).padStart(2, '0')}` : `${rest} min`;
}

export function formatDistance(distanceKm: number | null) {
  return distanceKm == null
    ? '—'
    : `${distanceKm.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`;
}
