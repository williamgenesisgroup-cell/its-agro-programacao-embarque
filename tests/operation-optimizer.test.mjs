import assert from 'node:assert/strict';
import test from 'node:test';

import {
  analyzeOperation,
  applyOperationSuggestion,
} from '../lib/operation-optimizer.ts';

const person = (id, lat, lng) => ({
  id,
  name: `Pessoa ${id}`,
  city: 'Londrina',
  lat,
  lng,
});
const location = (id, lat, lng) => ({
  id,
  name: `Local ${id}`,
  city: 'Londrina',
  lat,
  lng,
});

const suggestionMetric = (suggestion, priority) => {
  if (priority === 'km') return suggestion.suggestedKm;
  if (priority === 'time') return suggestion.suggestedMinutes;
  return suggestion.suggestedKm + suggestion.suggestedMinutes * 0.32;
};

void test('analisa dez pessoas e dez locais, sugere melhoria sem aplicar automaticamente', () => {
  const people = Array.from({ length: 10 }, (_, index) =>
    person(`p${index}`, -23.3 - index * 0.01, -51.15 - index * 0.01),
  );
  const locations = Array.from({ length: 10 }, (_, index) =>
    location(`l${index}`, -23.3 - index * 0.01, -51.15 - index * 0.01),
  );
  const assignments = locations.map((item, index) => ({
    id: `a${index}`,
    personId: people[9 - index].id,
    locationId: item.id,
  }));
  const before = structuredClone(assignments);
  const analysis = analyzeOperation({
    assignments,
    people,
    locations,
    priority: 'balanced',
  });
  assert.equal(analysis.status, 'recommended');
  assert.ok(analysis.suggestions.length > 0);
  assert.deepEqual(assignments, before);
  const applied = applyOperationSuggestion(
    assignments,
    analysis.suggestions[0],
  );
  assert.notDeepEqual(applied, assignments);
  const after = analyzeOperation({
    assignments: applied,
    people,
    locations,
    priority: 'balanced',
  });
  assert.ok((after.totalKm ?? Infinity) < (analysis.totalKm ?? Infinity));
});

void test('ordena pelo maior ganho nos três modos de prioridade', () => {
  const people = Array.from({ length: 10 }, (_, index) =>
    person(`p${index}`, -23.3 - index * 0.01, -51.15 - index * 0.01),
  );
  const locations = Array.from({ length: 10 }, (_, index) =>
    location(`l${index}`, -23.3 - index * 0.01, -51.15 - index * 0.01),
  );
  const assignments = locations.map((item, index) => ({
    id: `a${index}`,
    personId: people[9 - index].id,
    locationId: item.id,
  }));

  for (const priority of ['km', 'time', 'balanced']) {
    const analysis = analyzeOperation({
      assignments,
      people,
      locations,
      priority,
    });
    assert.ok(
      analysis.suggestions.length >= 3,
      `esperava pelo menos 3 sugestões em ${priority}`,
    );
    const topMetric = suggestionMetric(analysis.suggestions[0], priority);
    assert.ok(
      analysis.suggestions.every(
        (suggestion) => suggestionMetric(suggestion, priority) >= topMetric,
      ),
    );
    for (const suggestion of analysis.suggestions) {
      assert.equal(
        suggestion.economyKm,
        suggestion.currentKm - suggestion.suggestedKm,
      );
      assert.equal(
        suggestion.economyMinutes,
        suggestion.currentMinutes - suggestion.suggestedMinutes,
      );
      assert.ok(Number.isFinite(suggestion.economyPercent));
    }
  }
});

void test('aceita um calculador de rota real injetado e identifica confiança', () => {
  const realLeg = (from, to) => {
    if (
      from.lat == null ||
      from.lng == null ||
      to.lat == null ||
      to.lng == null
    )
      return null;
    const distanceKm =
      Math.abs(from.lat - to.lat) * 1000 + Math.abs(from.lng - to.lng) * 700;
    return {
      distanceKm: Math.max(1, distanceKm),
      durationMin: Math.round(distanceKm),
    };
  };
  const analysis = analyzeOperation({
    assignments: [{ id: 'a1', personId: 'p1', locationId: 'l1' }],
    people: [person('p1', -23.3, -51.15)],
    locations: [location('l1', -23.31, -51.16)],
    calculationMode: 'real',
    legCalculator: realLeg,
  });
  assert.equal(analysis.calculationMode, 'real');
  assert.equal(analysis.confidence, 'high');
  assert.match(analysis.factors[0], /ROTA REAL/);
});

void test('mantém a análise útil quando faltam coordenadas', () => {
  const analysis = analyzeOperation({
    assignments: [{ id: 'a1', personId: 'p1', locationId: 'l1' }],
    people: [person('p1', null, null)],
    locations: [location('l1', -23.3, -51.15)],
  });
  assert.equal(analysis.totalKm, null);
  assert.ok(analysis.missingCoordinates.includes('Pessoa p1'));
  assert.equal(analysis.suggestions.length, 0);
  assert.equal(analysis.confidence, 'low');
});
