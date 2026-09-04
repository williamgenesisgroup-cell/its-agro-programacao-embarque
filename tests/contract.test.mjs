import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('entrega os fluxos operacionais solicitados', async () => {
  const page = await readFile(
    new URL('../app/page.tsx', import.meta.url),
    'utf8',
  );
  assert.match(page, /Programação de embarque/);
  assert.match(page, /Compartilhar no WhatsApp/);
  assert.match(page, /Mapa da operação/);
  assert.match(page, /Comparar programação/);
  assert.match(page, /Local atual/);
  assert.match(page, /compareCandidateToDestination/);
  assert.match(page, /Armazém/);
  assert.match(page, /Buscar CEP/);
  assert.match(page, /viacep\.com\.br/);
  assert.match(page, /renderPersonEditor/);
  assert.match(page, /Mapa pronto para receber a operação/);
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
  assert.match(render, /healthCheckPath: \/api\/health/);
  assert.match(render, /start:render/);
});
