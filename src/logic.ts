// Pure schedule logic for the Hydro-Québec peak plugin.

export type Ev = { offre: string; datedebut: string; datefin: string };
export type Win = { from: number; to: number }; // minutes after local midnight
export type Level = 'peak' | 'soon' | 'window' | 'low';

/** "06:00-10:00, 16:00-20:00" → windows in minutes. */
export function parseWindows(s: string): Win[] {
  return String(s || '').split(',').map((p) => p.trim()).filter(Boolean).map((p) => {
    const [a, b] = p.split('-').map((x) => x.trim());
    const hm = (x: string) => { const [h, m] = x.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
    return { from: hm(a), to: hm(b) };
  }).filter((w) => w.to > w.from);
}

/** Season "12-01..03-31" (may wrap the new year). `md` is "MM-DD" local. */
export function inSeason(md: string, season: string): boolean {
  const [a, b] = String(season || '12-01..03-31').split('..').map((x) => x.trim());
  return a <= b ? md >= a && md <= b : md >= a || md <= b;
}

/** Days until the season next starts (0 if in season). */
export function daysToSeason(today: string, season: string): number {
  const start = String(season || '12-01..03-31').split('..')[0].trim();
  const [y] = today.split('-').map(Number);
  let s = new Date(`${y}-${start}T00:00:00Z`).getTime();
  const t = new Date(`${today}T00:00:00Z`).getTime();
  if (s < t) s = new Date(`${y + 1}-${start}T00:00:00Z`).getTime();
  return Math.round((s - t) / 86400000);
}

export function upcoming(evs: Ev[], now: number): Ev[] {
  return evs.filter((e) => +new Date(e.datefin) > now).sort((a, b) => +new Date(a.datedebut) - +new Date(b.datedebut));
}

export interface Status { level: Level; current?: Ev; next?: Ev; win?: Win; nextWin?: Win; nextWinTomorrow?: boolean }

/** Decide the colour/state: event now (red), event announced within 36 h (amber),
 *  inside a winter high-demand window (amber), otherwise off-peak (green). */
export function status(evs: Ev[], now: number, minute: number, winter: boolean, wins: Win[]): Status {
  const up = upcoming(evs, now);
  const current = up.find((e) => +new Date(e.datedebut) <= now);
  const next = up.find((e) => +new Date(e.datedebut) > now);
  const win = winter ? wins.find((w) => minute >= w.from && minute < w.to) : undefined;
  const later = wins.find((w) => w.from > minute);
  const nextWin = winter ? later ?? wins[0] : undefined;
  const nextWinTomorrow = winter && !later && wins.length > 0;
  const level: Level = current ? 'peak' : next && +new Date(next.datedebut) - now < 36 * 3600000 ? 'soon' : win ? 'window' : 'low';
  return { level, current, next, win, nextWin, nextWinTomorrow };
}

export const RATES: Record<string, { name: string; offers: string; low: string; high: string; note: string }> = {
  'flex-d': { name: 'Rate Flex D', offers: 'TPC-DPC', low: 'from 4.89¢', high: '46.46¢', note: 'Winter: cheaper outside peak events, much dearer during them.' },
  'winter-credit': { name: 'Winter Credit Option', offers: 'CPC-D', low: '6.89¢', high: 'credit', note: 'Cut use during peak events to earn a credit.' },
  'rate-d': { name: 'Rate D', offers: 'TPC-DPC, CPC-D', low: '6.89¢ · 10.80¢ over 40 kWh/day', high: '6.89¢ · 10.80¢ over 40 kWh/day', note: 'Same price all day — peak times only matter for the grid.' },
};
