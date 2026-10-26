const REPORT_TIME_ZONE = 'America/Sao_Paulo';
const datePartsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: REPORT_TIME_ZONE,
  calendar: 'iso8601',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function localPartsAt(timestamp: number) {
  const parts = Object.fromEntries(datePartsFormatter.formatToParts(timestamp).map(({ type, value }) => [type, value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

function representedLocalTimeAsUtc(local: ReturnType<typeof localPartsAt>): number {
  return Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
}

function sameCalendarDate(local: ReturnType<typeof localPartsAt>, year: number, month: number, day: number): boolean {
  return local.year === year && local.month === month && local.day === day;
}

function utcMidnightForLocalDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const targetAsUtc = Date.UTC(year, month - 1, day);
  const offsets = [-36, -24, 0, 24, 36].map((hours) => {
    const sample = targetAsUtc + hours * 60 * 60 * 1000;
    return representedLocalTimeAsUtc(localPartsAt(sample)) - sample;
  });
  const candidates = [...new Set(offsets)].map((offset) => {
    const timestamp = targetAsUtc - offset;
    return { timestamp, local: localPartsAt(timestamp) };
  }).filter(({ local }) => sameCalendarDate(local, year, month, day));

  if (candidates.length === 0) {
    throw new RangeError(`A data local ${date} não existe em ${REPORT_TIME_ZONE}.`);
  }

  const midnights = candidates.filter(({ local }) => local.hour === 0 && local.minute === 0 && local.second === 0);
  if (midnights.length > 0) {
    return new Date(Math.min(...midnights.map(({ timestamp }) => timestamp)));
  }

  candidates.sort((left, right) => {
    const leftTime = left.local.hour * 3600 + left.local.minute * 60 + left.local.second;
    const rightTime = right.local.hour * 3600 + right.local.minute * 60 + right.local.second;
    return leftTime - rightTime || left.timestamp - right.timestamp;
  });
  return new Date(candidates[0].timestamp);
}

function nextCalendarDate(date: string): string {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

export function intervaloRelatorioUtc(inicio: string, fim: string) {
  return {
    inicio: utcMidnightForLocalDate(inicio),
    fimExclusivo: utcMidnightForLocalDate(nextCalendarDate(fim)),
  };
}
