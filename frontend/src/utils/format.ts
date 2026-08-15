const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
});

/** Money is always rendered through here so every screen agrees on the format. */
export const formatBRL = (value: number): string => BRL.format(Number(value) || 0);

/**
 * Date-only columns come back as `YYYY-MM-DD`. Noon UTC keeps the calendar day
 * stable regardless of the viewer's timezone offset.
 */
export const formatDateBR = (value?: string | null, fallback = '—'): string =>
  value ? new Date(`${value}T12:00:00Z`).toLocaleDateString('pt-BR') : fallback;

export const todayISO = (): string => new Date().toISOString().slice(0, 10);
