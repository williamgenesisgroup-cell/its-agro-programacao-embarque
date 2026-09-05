import assert from 'node:assert/strict';
import test from 'node:test';

import { compareCandidateToDestination } from '../lib/logistics-service.ts';

const candidate = (id, lat, lng) => ({
  id,
  name: id,
  point: { id, label: id, address: id, city: 'Londrina', lat, lng },
});
const destination = {
  id: 'destino',
  label: 'Destino',
  address: 'Destino',
  city: 'Londrina',
  lat: 0,
  lng: 0,
};

void test('sugere troca com economia relevante de km e tempo', () => {
  const result = compareCandidateToDestination(
    [candidate('original', 10, 0)],
    [candidate('melhor', 1, 0)],
    destination,
  );
  assert.equal(result?.original.id, 'original');
  assert.equal(result?.suggested.id, 'melhor');
  assert.ok((result?.originalKm ?? 0) - (result?.suggestedKm ?? 0) > 60);
  assert.ok((result?.originalMin ?? 0) > (result?.suggestedMin ?? 0));
});

void test('não sugere quando a economia não atinge o limite', () => {
  const result = compareCandidateToDestination(
    [candidate('original', 1, 0)],
    [candidate('parecido', 1.1, 0)],
    destination,
  );
  assert.equal(result, null);
});

void test('ignora candidato ocupado e mantém a sugestão opcional', () => {
  const result = compareCandidateToDestination(
    [candidate('original', 10, 0)],
    [candidate('ocupado', 0.5, 0), candidate('livre', 2, 0)],
    destination,
    new Set(['ocupado']),
  );
  assert.equal(result?.suggested.id, 'livre');
});

void test('não inventa economia em rotas opostas equivalentes', () => {
  const result = compareCandidateToDestination(
    [candidate('norte', 1, 0)],
    [candidate('sul', -1, 0)],
    destination,
  );
  assert.equal(result, null);
});
