export type WhatsAppMode = 'resumido' | 'completo';

export type WhatsAppRow = {
  number: number;
  name: string;
  destination: string;
  time?: string | null;
  address?: string;
};

function dateLabel(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}` : value;
}

export function shortName(value: string) {
  return (
    value.trim().split(/\s+/).slice(0, 2).join(' ').toUpperCase() ||
    'NOME NÃO DEFINIDO'
  );
}

export function shortAddress(value: string) {
  return value
    .replace(/\s+·\s+\S+\/\S+$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildMassWhatsAppMessage({
  date,
  rows,
  mode = 'resumido',
  includeAddresses = false,
}: {
  date: string;
  rows: WhatsAppRow[];
  mode?: WhatsAppMode;
  includeAddresses?: boolean;
}) {
  const withTimes = rows.some((row) => Boolean(row.time));
  const header = withTimes
    ? `🚐 *PROGRAMAÇÃO – ${dateLabel(date)}*`
    : `🚐 *PROGRAMAÇÃO DE EMBARQUE – ${dateLabel(date)}*`;
  const lines = [header, ''];
  rows.forEach((row) => {
    const prefix = withTimes && row.time ? `${row.time} • ` : '';
    const number = String(row.number).padStart(2, '0');
    lines.push(
      `${number} • ${prefix}${shortName(row.name)} → ${row.destination || '⚠️ DESTINO NÃO DEFINIDO'}`,
    );
    if ((mode === 'completo' || includeAddresses) && row.address) {
      lines.push(`📍 ${shortAddress(row.address)}`);
    }
  });
  lines.push(
    '',
    withTimes
      ? '⚠️ Estejam prontos nos horários informados.'
      : '⚠️ Estejam prontos conforme programação.',
  );
  return lines.join('\n');
}
