import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildRoutePlan,
  estimateLeg,
  optimizeOrder,
} from '../lib/route-service.ts';

const point = (id, lat, lng) => ({
  id,
  label: id,
  address: id,
  city: 'Londrina',
  lat,
  lng,
});

void test('estima uma perna apenas quando existem coordenadas', () => {
  assert.ok(
    estimateLeg(point('a', -23.31, -51.17), point('b', -23.32, -51.16))
      ?.distanceKm > 0,
  );
  assert.equal(
    estimateLeg(
      { ...point('a', -23.31, -51.17), lat: undefined },
      point('b', -23.32, -51.16),
    ),
    null,
  );
});

void test('otimiza a ordem e calcula horários regressivos até o destino', () => {
  const destination = point('destino', -23.3, -51.15);
  const people = [
    point('longe', -23.55, -51.3),
    point('perto', -23.31, -51.16),
    point('meio', -23.4, -51.23),
  ];
  const ordered = optimizeOrder(people, destination);
  assert.equal(new Set(ordered.map((item) => item.id)).size, 3);
  const plan = buildRoutePlan({
    points: people,
    destination,
    departureTime: '18:00',
    arrivalLeadMinutes: 30,
    stopBufferMinutes: 8,
  });
  assert.equal(plan.stops.length, 3);
  assert.ok(plan.totalKm > 0);
  assert.ok(plan.totalMinutes > 0);
  assert.ok(plan.stops.every((stop) => stop.pickupTime));
  assert.equal(plan.arrivalTime, '17:30');
  assert.equal(plan.calculationMode, 'estimate');
  assert.equal(plan.confidence, 'medium');
  assert.match(plan.notice, /ESTIMATIVA RÁPIDA/i);
});

void test('mantém a ordem informada quando faltam coordenadas', () => {
  const destination = point('destino', -23.3, -51.15);
  const people = [
    point('primeiro', undefined, undefined),
    point('segundo', -23.31, -51.16),
  ];
  const plan = buildRoutePlan({
    points: people,
    destination,
    departureTime: '18:00',
    arrivalLeadMinutes: 30,
    stopBufferMinutes: 8,
  });
  assert.deepEqual(
    plan.stops.map((stop) => stop.id),
    ['primeiro', 'segundo'],
  );
  assert.equal(plan.totalKm, null);
  assert.equal(plan.confidence, 'low');
  assert.match(plan.notice, /latitude e longitude/i);
});

void test('aceita rota real por adaptador configurado sem expor credenciais', () => {
  const destination = point('destino', -23.3, -51.15);
  const people = [point('pessoa', -23.31, -51.16)];
  const realRouteCalculator = () => ({ distanceKm: 12.4, durationMin: 19 });
  const plan = buildRoutePlan({
    points: people,
    destination,
    departureTime: '18:00',
    arrivalLeadMinutes: 30,
    stopBufferMinutes: 8,
    calculationMode: 'real',
    realRouteCalculator,
  });
  assert.equal(plan.calculationMode, 'real');
  assert.equal(plan.confidence, 'high');
  assert.equal(plan.isApproximate, false);
  assert.equal(plan.totalKm, 12.4);
  assert.match(plan.notice, /ROTA REAL/);
});

void test('volta para estimativa quando o adaptador real não retorna uma perna', () => {
  const plan = buildRoutePlan({
    points: [point('pessoa', -23.31, -51.16)],
    destination: point('destino', -23.3, -51.15),
    departureTime: '18:00',
    arrivalLeadMinutes: 30,
    stopBufferMinutes: 8,
    calculationMode: 'real',
    realRouteCalculator: () => null,
  });
  assert.equal(plan.calculationMode, 'estimate');
  assert.equal(plan.confidence, 'medium');
  assert.equal(plan.isApproximate, true);
  assert.match(plan.notice, /provedor rodoviário não retornou/i);
});
