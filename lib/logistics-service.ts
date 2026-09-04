import { estimateLeg } from './route-service.mjs';
import type { RoutePoint } from './route-service';

export type LogisticsCandidate = {
  id: string;
  name: string;
  point: RoutePoint;
};

export type SwapSuggestion = {
  original: LogisticsCandidate;
  suggested: LogisticsCandidate;
  originalKm: number;
  suggestedKm: number;
  originalMin: number;
  suggestedMin: number;
};

export function compareCandidateToDestination(
  selected: LogisticsCandidate[],
  available: LogisticsCandidate[],
  destination: RoutePoint,
  blockedIds = new Set<string>(),
): SwapSuggestion | null {
  const selectedRank = selected
    .map((candidate) => ({ candidate, leg: estimateLeg(candidate.point, destination) }))
    .filter((item) => item.leg)
    .sort((a, b) => (b.leg?.distanceKm ?? 0) - (a.leg?.distanceKm ?? 0))[0];
  const suggestedRank = available
    .filter((candidate) => !blockedIds.has(candidate.id))
    .map((candidate) => ({ candidate, leg: estimateLeg(candidate.point, destination) }))
    .filter((item) => item.leg)
    .sort((a, b) => (a.leg?.distanceKm ?? Infinity) - (b.leg?.distanceKm ?? Infinity))[0];

  if (!selectedRank?.leg || !suggestedRank?.leg) return null;
  if (suggestedRank.leg.distanceKm + 60 >= selectedRank.leg.distanceKm) return null;
  return {
    original: selectedRank.candidate,
    suggested: suggestedRank.candidate,
    originalKm: selectedRank.leg.distanceKm,
    suggestedKm: suggestedRank.leg.distanceKm,
    originalMin: selectedRank.leg.durationMin,
    suggestedMin: suggestedRank.leg.durationMin,
  };
}
