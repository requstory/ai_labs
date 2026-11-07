/**
 * Reads the text the "Coach Health" Shortcut copies to the clipboard, for example:
 *   COACH-HEALTH
 *   weight: 112.4 kg
 *   vo2: 26.4 mL/min·kg
 *   waist: 104 cm
 *   date: 16 Nov 2026 at 07:12
 * Shortcuts formats numbers with the phone's locale, so decimal commas are accepted.
 */
export type HealthImport = { weight?: number; vo2?: number; waist?: number; date?: string };

const num = (s: string | undefined): number | undefined => {
  if (!s) return undefined;
  const m = s.replace(/\s/g, '').match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return undefined;
  const v = Number(m[0].replace(',', '.'));
  return Number.isFinite(v) ? v : undefined;
};

export function parseHealth(text: string): HealthImport | null {
  if (!/COACH-HEALTH/i.test(text)) return null;
  const field = (key: string) => text.match(new RegExp(`^\\s*${key}\\s*[:=]\\s*(.+)$`, 'im'))?.[1]?.trim();
  const out: HealthImport = {};
  let weight = num(field('weight'));
  // Shortcuts may hand over grams or pounds depending on the Health unit; normalise to kg.
  const wText = field('weight') ?? '';
  if (weight !== undefined && /lb/i.test(wText)) weight = +(weight * 0.45359237).toFixed(1);
  if (weight !== undefined && weight > 1000) weight = +(weight / 1000).toFixed(1);
  if (weight !== undefined && weight > 20 && weight < 400) out.weight = +weight.toFixed(1);
  const vo2 = num(field('vo2') ?? field('vo2 ?max'));
  if (vo2 !== undefined && vo2 > 5 && vo2 < 100) out.vo2 = +vo2.toFixed(1);
  let waist = num(field('waist'));
  if (waist !== undefined && /in(ch)?/i.test(field('waist') ?? '') && !/cm/i.test(field('waist') ?? '')) waist = +(waist * 2.54).toFixed(1);
  if (waist !== undefined && waist > 30 && waist < 250) out.waist = +waist.toFixed(1);
  const date = field('date');
  if (date) out.date = date;
  return out.weight !== undefined || out.vo2 !== undefined || out.waist !== undefined ? out : null;
}
