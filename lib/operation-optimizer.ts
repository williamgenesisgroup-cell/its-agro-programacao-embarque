import { estimateLeg } from './route-service.mjs';
import type {
  RouteCalculationMode,
  RouteConfidence,
  RouteLegCalculator,
  RoutePoint,
} from './route-service';

export type OptimizerPerson = {
  id: string;
  name: string;
  city?: string;
  lat?: number | null;
  lng?: number | null;
  active?: boolean;
  operationalStatus?: string;
};

export type OptimizerLocation = {
  id: string;
  name: string;
  city?: string;
  type?: string;
  lat?: number | null;
  lng?: number | null;
  openingHours?: string;
  active?: boolean;
};

export type OperationAssignment = {
  id: string;
  personId: string;
  locationId: string;
  time?: string;
};

export type OperationPriority = 'km' | 'time' | 'balanced';

export type OperationSuggestion = {
  id: string;
  kind: 'swap' | 'move';
  assignmentId: string;
  otherAssignmentId?: string;
  originalPersonId: string;
  suggestedPersonId: string;
  originalLocationId: string;
  suggestedLocationId: string;
  currentKm: number | null;
  suggestedKm: number | null;
  currentMinutes: number | null;
  suggestedMinutes: number | null;
  economyKm: number;
  economyMinutes: number;
  economyPercent: number;
  reason: string;
};

export type OperationAnalysis = {
  status: 'coherent' | 'recommended';
  score: number;
  totalKm: number | null;
  totalMinutes: number | null;
  conflicts: string[];
  crossings: number;
  missingCoordinates: string[];
  suggestions: OperationSuggestion[];
  factors: string[];
  priority: OperationPriority;
  calculationMode: RouteCalculationMode;
  confidence: RouteConfidence;
  limits: {
    maxDistanceKm: number | null;
    maxMinutes: number | null;
  };
};

type AssignmentEvaluation = {
  totalKm: number | null;
  totalMinutes: number | null;
  missingCoordinates: string[];
  conflicts: string[];
  crossings: number;
};

function pointForPerson(person: OptimizerPerson): RoutePoint {
  return {
    id: person.id,
    label: person.name,
    address: person.city ?? '',
    city: person.city ?? '',
    lat: person.lat ?? undefined,
    lng: person.lng ?? undefined,
  };
}

function pointForLocation(location: OptimizerLocation): RoutePoint {
  return {
    id: location.id,
    label: location.name,
    address: location.city ?? '',
    city: location.city ?? '',
    lat: location.lat ?? undefined,
    lng: location.lng ?? undefined,
  };
}

function metric(
  km: number | null,
  minutes: number | null,
  priority: OperationPriority,
) {
  if (km == null || minutes == null) return Number.POSITIVE_INFINITY;
  if (priority === 'km') return km;
  if (priority === 'time') return minutes;
  return km + minutes * 0.32;
}

function economy(current: number | null, suggested: number | null) {
  return current != null && suggested != null ? current - suggested : 0;
}

function economyPercent(current: number | null, suggested: number | null) {
  if (current == null || suggested == null || current <= 0) return 0;
  return ((current - suggested) / current) * 100;
}

function orientation(
  a: [number, number],
  b: [number, number],
  c: [number, number],
) {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function segmentsCross(
  a: [number, number],
  b: [number, number],
  c: [number, number],
  d: [number, number],
) {
  const first = orientation(a, b, c) * orientation(a, b, d);
  const second = orientation(c, d, a) * orientation(c, d, b);
  return first < 0 && second < 0;
}

function evaluateAssignments(
  assignments: OperationAssignment[],
  peopleById: Map<string, OptimizerPerson>,
  locationsById: Map<string, OptimizerLocation>,
  limits: { maxDistanceKm: number | null; maxMinutes: number | null },
  calculateLeg: RouteLegCalculator,
): AssignmentEvaluation {
  let totalKm = 0;
  let totalMinutes = 0;
  let hasMissing = false;
  const missingCoordinates: string[] = [];
  const conflicts: string[] = [];
  const segments: Array<[[number, number], [number, number]]> = [];
  const seenPeople = new Set<string>();

  for (const assignment of assignments) {
    if (!assignment.personId || !assignment.locationId) {
      conflicts.push('Existe uma linha sem pessoa ou local definido.');
      continue;
    }
    if (seenPeople.has(assignment.personId)) {
      conflicts.push('A mesma pessoa foi atribuída mais de uma vez.');
    }
    seenPeople.add(assignment.personId);
    const person = peopleById.get(assignment.personId);
    const location = locationsById.get(assignment.locationId);
    if (!person || !location) {
      conflicts.push('Existe uma atribuição para um cadastro removido.');
      continue;
    }
    if (person.operationalStatus === 'Indisponível') {
      conflicts.push(`${person.name} está marcada como indisponível.`);
    }
    const leg = calculateLeg(
      pointForPerson(person),
      pointForLocation(location),
    );
    if (!leg) {
      hasMissing = true;
      missingCoordinates.push(person.name, location.name);
      continue;
    }
    totalKm += leg.distanceKm;
    totalMinutes += leg.durationMin;
    if (limits.maxDistanceKm != null && leg.distanceKm > limits.maxDistanceKm) {
      conflicts.push(
        `${person.name} está a ${leg.distanceKm.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km de ${location.name}.`,
      );
    }
    if (limits.maxMinutes != null && leg.durationMin > limits.maxMinutes) {
      conflicts.push(
        `${person.name} leva cerca de ${leg.durationMin} min até ${location.name}.`,
      );
    }
    if (
      person.lat != null &&
      person.lng != null &&
      location.lat != null &&
      location.lng != null
    ) {
      segments.push([
        [person.lng, person.lat],
        [location.lng, location.lat],
      ]);
    }
    if (assignment.time && location.openingHours) {
      const match = location.openingHours.match(
        /(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})/,
      );
      if (match && (assignment.time < match[1] || assignment.time > match[2])) {
        conflicts.push(
          `${location.name} informa atendimento de ${match[1]} a ${match[2]}.`,
        );
      }
    }
  }
  for (let first = 0; first < segments.length; first += 1) {
    for (let second = first + 1; second < segments.length; second += 1) {
      if (segmentsCross(...segments[first], ...segments[second]))
        conflicts.push('Há rotas que se cruzam entre pessoas e destinos.');
    }
  }
  const uniqueMissing = [...new Set(missingCoordinates)];
  return {
    totalKm: hasMissing ? null : totalKm,
    totalMinutes: hasMissing ? null : totalMinutes,
    missingCoordinates: uniqueMissing,
    conflicts: [...new Set(conflicts)],
    crossings: conflicts.filter((item) => item.includes('se cruzam')).length,
  };
}

function swapAssignments(
  assignments: OperationAssignment[],
  first: number,
  second: number,
) {
  return assignments.map((assignment, index) => {
    if (index === first)
      return { ...assignment, personId: assignments[second].personId };
    if (index === second)
      return { ...assignment, personId: assignments[first].personId };
    return { ...assignment };
  });
}

export function applyOperationSuggestion(
  assignments: OperationAssignment[],
  suggestion: OperationSuggestion,
) {
  if (suggestion.kind === 'swap' && suggestion.otherAssignmentId) {
    const first = assignments.find(
      (item) => item.id === suggestion.assignmentId,
    );
    const second = assignments.find(
      (item) => item.id === suggestion.otherAssignmentId,
    );
    if (!first || !second) return assignments.map((item) => ({ ...item }));
    return assignments.map((item) => {
      if (item.id === first.id) return { ...item, personId: second.personId };
      if (item.id === second.id) return { ...item, personId: first.personId };
      return { ...item };
    });
  }
  return assignments.map((item) =>
    item.id === suggestion.assignmentId
      ? { ...item, personId: suggestion.suggestedPersonId }
      : { ...item },
  );
}

export function analyzeOperation({
  assignments,
  people,
  locations,
  priority = 'balanced',
  maxDistanceKm = null,
  maxMinutes = null,
  calculationMode = 'estimate',
  legCalculator,
}: {
  assignments: OperationAssignment[];
  people: OptimizerPerson[];
  locations: OptimizerLocation[];
  priority?: OperationPriority;
  maxDistanceKm?: number | null;
  maxMinutes?: number | null;
  calculationMode?: RouteCalculationMode;
  legCalculator?: RouteLegCalculator;
}): OperationAnalysis {
  const calculateLeg: RouteLegCalculator =
    calculationMode === 'real' && legCalculator ? legCalculator : estimateLeg;
  const effectiveMode: RouteCalculationMode =
    calculationMode === 'real' && legCalculator ? 'real' : 'estimate';
  const peopleById = new Map(
    people
      .filter((person) => person.active !== false)
      .map((person) => [person.id, person]),
  );
  const locationsById = new Map(
    locations
      .filter((location) => location.active !== false)
      .map((location) => [location.id, location]),
  );
  const limits = { maxDistanceKm, maxMinutes };
  const current = evaluateAssignments(
    assignments,
    peopleById,
    locationsById,
    limits,
    calculateLeg,
  );
  const suggestions: OperationSuggestion[] = [];
  const baseline = metric(current.totalKm, current.totalMinutes, priority);

  for (let first = 0; first < assignments.length; first += 1) {
    for (let second = first + 1; second < assignments.length; second += 1) {
      if (!assignments[first].personId || !assignments[second].personId)
        continue;
      const candidateAssignments = swapAssignments(assignments, first, second);
      const candidate = evaluateAssignments(
        candidateAssignments,
        peopleById,
        locationsById,
        limits,
        calculateLeg,
      );
      const candidateMetric = metric(
        candidate.totalKm,
        candidate.totalMinutes,
        priority,
      );
      const improvement = baseline - candidateMetric;
      if (Number.isFinite(improvement) && improvement > 2) {
        const firstPerson = peopleById.get(assignments[first].personId);
        const secondPerson = peopleById.get(assignments[second].personId);
        const firstLocation = locationsById.get(assignments[first].locationId);
        const secondLocation = locationsById.get(
          assignments[second].locationId,
        );
        if (!firstPerson || !secondPerson || !firstLocation || !secondLocation)
          continue;
        suggestions.push({
          id: `swap-${assignments[first].id}-${assignments[second].id}`,
          kind: 'swap',
          assignmentId: assignments[first].id,
          otherAssignmentId: assignments[second].id,
          originalPersonId: firstPerson.id,
          suggestedPersonId: secondPerson.id,
          originalLocationId: firstLocation.id,
          suggestedLocationId: secondLocation.id,
          currentKm: current.totalKm,
          suggestedKm: candidate.totalKm,
          currentMinutes: current.totalMinutes,
          suggestedMinutes: candidate.totalMinutes,
          economyKm: economy(current.totalKm, candidate.totalKm),
          economyMinutes: economy(current.totalMinutes, candidate.totalMinutes),
          economyPercent: economyPercent(current.totalKm, candidate.totalKm),
          reason: `${secondPerson.name} fica mais perto de ${firstLocation.name}; ${firstPerson.name} atende melhor ${secondLocation.name}.`,
        });
      }
    }
  }
  suggestions.sort(
    (a, b) =>
      metric(a.suggestedKm, a.suggestedMinutes, priority) -
        metric(b.suggestedKm, b.suggestedMinutes, priority) ||
      b.economyKm - a.economyKm ||
      b.economyMinutes - a.economyMinutes,
  );
  const bestSuggestions = suggestions.slice(0, 3);
  const factors: string[] = [];
  if (current.missingCoordinates.length)
    factors.push(
      'Há cadastros sem coordenadas confirmadas; a distância total precisa ser completada no mapa.',
    );
  if (current.crossings) factors.push('⚠️ POSSÍVEL CRUZAMENTO LOGÍSTICO');
  if (current.conflicts.length)
    factors.push(
      'Existem conflitos de distância, horário ou disponibilidade para revisar.',
    );
  if (bestSuggestions.length)
    factors.push(
      'As sugestões priorizam menor deslocamento e preservam a decisão manual da operação.',
    );
  factors.unshift(
    effectiveMode === 'real'
      ? 'ROTA REAL: cálculo preparado para o provedor rodoviário configurado.'
      : 'ESTIMATIVA RÁPIDA: cálculo por coordenadas; não representa uma rota rodoviária real.',
  );
  if (
    factors.length === 1 &&
    !current.conflicts.length &&
    !bestSuggestions.length
  )
    factors.push('A programação está coerente com os dados disponíveis.');
  const penalty =
    current.conflicts.length * 12 +
    current.crossings * 8 +
    current.missingCoordinates.length * 3;
  const score = Math.max(
    0,
    Math.min(100, Math.round(100 - penalty - bestSuggestions.length * 2)),
  );
  return {
    status:
      current.conflicts.length || bestSuggestions.length
        ? 'recommended'
        : 'coherent',
    score,
    totalKm: current.totalKm,
    totalMinutes: current.totalMinutes,
    conflicts: current.conflicts,
    crossings: current.crossings,
    missingCoordinates: current.missingCoordinates,
    suggestions: bestSuggestions,
    factors,
    priority,
    calculationMode: effectiveMode,
    confidence: current.missingCoordinates.length
      ? 'low'
      : effectiveMode === 'real'
        ? 'high'
        : 'medium',
    limits,
  };
}
