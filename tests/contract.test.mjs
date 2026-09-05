import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

void test('entrega os fluxos operacionais solicitados', async () => {
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
    page.match(/const LOCATION_TYPES = \[([\s\S]*?)\](?: as const)?;/)?.[1] ?? '';
  const locationTypes = [...typeOptions.matchAll(/'([^']+)'/g)].map(
    (match) => match[1],
  );
  assert.deepEqual(locationTypes, ['FAZENDA', 'ARMAZÉM', 'VAGÃO']);
  assert.doesNotMatch(
    typeOptions,
    /Aeroporto|Rodoviária|Hotel|Empresa|Unidade|Silo|Terminal|Porto|Pátio|Filial|Ponto de encontro|Outro/,
  );
  assert.match(page, /function canonicalLocationType/);
  assert.match(page, /if \(rawType === 'VAGAO'\) return 'VAGÃO'/);
  assert.match(page, /Selecione/);
  assert.match(page, /locationTypeFilter/);
  assert.match(page, /<option value="VAGÃO">Vagão<\/option>/);
  assert.match(page, /<span>Vagões<\/span>/);
  assert.match(page, /function locationMarkerType/);
  assert.match(page, /return 'vagao'/);
  assert.match(page, /Enviar feedback/);
  assert.match(page, /Exportar backup/);
  assert.match(page, /AMBIENTE DE TESTES/);
  assert.match(page, /ONLINE — DADOS SINCRONIZADOS/);
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

void test('mantém contrato de banco e publicação', async () => {
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
  assert.match(migration, /location_type text not null default 'FAZENDA'/);
  assert.match(migration, /add column if not exists wagon_number text/);
  assert.match(render, /healthCheckPath: \/api\/health/);
  assert.match(render, /start:render/);
});
