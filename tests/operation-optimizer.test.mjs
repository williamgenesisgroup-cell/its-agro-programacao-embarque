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

test('analisa dez pessoas e dez locais, sugere melhoria sem aplicar automaticamente', () => {
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

test('mantém a análise útil quando faltam coordenadas', () => {
  const analysis = analyzeOperation({
    assignments: [{ id: 'a1', personId: 'p1', locationId: 'l1' }],
    people: [person('p1', null, null)],
    locations: [location('l1', -23.3, -51.15)],
  });
  assert.equal(analysis.totalKm, null);
  assert.ok(analysis.missingCoordinates.includes('Pessoa p1'));
  assert.equal(analysis.suggestions.length, 0);
});
