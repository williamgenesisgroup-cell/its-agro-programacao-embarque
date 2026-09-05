import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('entrega os fluxos operacionais solicitados', async () => {
  const page = await readFile(
    new URL('../app/page.tsx', import.meta.url),
    'utf8',
  );
  assert.match(page, /Programação de embarque/);
  assert.match(page, /Compartilhar programação/);
  assert.match(page, /Mapa da operação/);
  assert.match(page, /Comparar programação/);
  assert.match(page, /Local atual/);
  assert.match(page, /compareCandidateToDestination/);
  const typeOptions =
    page.match(/const LOCATION_TYPES = \[([\s\S]*?)\];/)?.[1] ?? '';
  assert.match(typeOptions, /FAZENDA/);
  assert.match(typeOptions, /ARMAZÉM/);
  assert.match(typeOptions, /VAGÃO/);
  assert.doesNotMatch(
    typeOptions,
    /Aeroporto|Rodoviária|Hotel|Empresa|Unidade|Silo|Terminal|Porto|Pátio|Filial|Ponto de encontro|Outro/,
  );
  assert.match(page, /Selecione/);
  assert.match(page, /locationTypeFilter/);
  assert.match(page, /business-map-icon-\$\{type\}/);
  assert.match(page, /Confirmar coordenadas/);
  assert.match(page, /Planejamento do dia/);
  assert.match(page, /Analisar programação/);
  assert.match(page, /applyOperationSuggestion/);
  assert.match(page, /OpenStreetMap\/Nominatim/);
  assert.match(page, /Buscar CEP/);
  assert.match(page, /viacep\.com\.br/);
  assert.match(page, /renderPersonEditor/);
  assert.match(page, /Mapa pronto para receber a operação/);
  assert.match(page, /function renderPeoplePage/);
  assert.match(page, /function renderLocationsPage/);
  assert.match(page, /function renderSchedulePage/);
  assert.doesNotMatch(
    page,
    /return <(?:PeoplePage|LocationsPage|SchedulePage|RoutesPage|HistoryPage|Dashboard)\s*\/>/,
  );
  assert.doesNotMatch(page, /autoFocus/);
});

test('mantém contrato de banco e publicação', async () => {
  const migration = await readFile(
    new URL('../db/migrations/001_init.sql', import.meta.url),
    'utf8',
  );
  const render = await readFile(
    new URL('../render.yaml', import.meta.url),
    'utf8',
  );
  assert.match(migration, /create table if not exists public\.people/);
  assert.match(
    migration,
    /create table if not exists public\.suggestion_history/,
  );
  assert.match(migration, /enable row level security/);
  assert.match(migration, /boarding_location_access_points/);
  assert.match(migration, /operation_plans/);
  assert.match(migration, /location_audit_history/);
  assert.match(render, /healthCheckPath: \/api\/health/);
  assert.match(render, /start:render/);
});
