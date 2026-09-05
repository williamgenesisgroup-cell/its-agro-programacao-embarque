import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildMassWhatsAppMessage } from '../lib/whatsapp.ts';

function rows(count) {
  return Array.from({ length: count }, (_, index) => ({
    number: index + 1,
    name: `Pessoa ${index + 1}`,
    destination: `Destino ${index + 1}`,
    time: `${String(20 - Math.floor(index / 2)).padStart(2, '0')}:${index % 2 ? '30' : '00'}`,
    address: `Rua Teste ${index + 1}, ${index + 10} - Centro · Cidade/PR`,
  }));
}

test('gera uma única mensagem resumida para 1, 5 e 10 pessoas', () => {
  for (const count of [1, 5, 10]) {
    const message = buildMassWhatsAppMessage({
      date: '2026-09-04',
      rows: rows(count),
    });
    assert.equal((message.match(/PROGRAMAÇÃO/g) || []).length, 1);
    assert.equal((message.match(/→/g) || []).length, count);
    assert.equal(message.includes('Rua Teste'), false);
    assert.equal(message.includes('Centro'), false);
    assert.equal(message.includes('📍'), false);
  }
});

test('modo completo inclui endereço resumido e mantém ordem', () => {
  const message = buildMassWhatsAppMessage({
    date: '2026-09-04',
    rows: rows(2),
    mode: 'completo',
  });
  assert.match(message, /01 • 20:00 • PESSOA 1 → Destino 1/);
  assert.match(message, /02 • 20:30 • PESSOA 2 → Destino 2/);
  assert.match(message, /📍 Rua Teste 1, 10 - Centro/);
  assert.match(message, /⚠️ Estejam prontos nos horários informados\./);
});

test('sem horários usa o cabeçalho curto sem criar linhas individuais de conversa', () => {
  const message = buildMassWhatsAppMessage({
    date: '2026-09-04',
    rows: rows(3).map((row) => ({ ...row, time: null })),
  });
  assert.match(message, /🚐 \*PROGRAMAÇÃO DE EMBARQUE – 04\/09\*/);
  assert.equal((message.match(/→/g) || []).length, 3);
  assert.match(message, /⚠️ Estejam prontos conforme programação\./);
});
