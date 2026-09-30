import React from 'react';
import type { PluginComponentProps } from './hs-plugin';
import { frame, ink, sdk, useNow, fmtTime, dayKey, localHM, Fit } from './ui';
import { Ev, Win, Level, parseWindows, inSeason, daysToSeason, status, RATES } from './logic';

const URL_BASE = 'https://donnees.hydroquebec.com/api/explore/v2.1/catalog/datasets/evenements-pointe/records';
const COLORS: Record<Level, string> = { peak: '#dc2626', soon: '#f59e0b', window: '#f59e0b', low: '#16a34a' };

export default function HydroPeak({ config, style, timezone: tz, ...rest }: PluginComponentProps & { timeFormat?: string }) {
  const now = useNow(30000);
  const tf = (rest as any).timeFormat;
  const rate = RATES[String(config.rate || 'flex-d')] ?? RATES['flex-d'];
  const offers = String(config.offers || rate.offers).split(',').map((s) => s.trim()).filter(Boolean);
  const wins = parseWindows(String(config.windows || '06:00-10:00, 16:00-20:00'));
  const season = String(config.season || '12-01..03-31');
  const showPrices = config.showPrices !== false;
  const priceLow = String(config.priceLow || rate.low), priceHigh = String(config.priceHigh || rate.high);

  const [evs, setEvs] = React.useState<Ev[]>([]);
  const [err, setErr] = React.useState(false);
  const tick = Math.floor(now.getTime() / 900000);
  React.useEffect(() => { (async () => {
    try {
      const where = `offre in (${offers.map((o) => `"${o}"`).join(',')})`;
      const url = `${URL_BASE}?where=${encodeURIComponent(where)}&order_by=${encodeURIComponent('datedebut desc')}&limit=30`;
      const res: Response = await sdk().pluginFetch('hydro-peak', { url, cacheTtlMs: 900000 });
      if (!res.ok) throw new Error(String(res.status));
      const j = await res.json(); setEvs(j.results ?? []); setErr(false);
    } catch { setErr(true); }
  })(); }, [tick, offers.join(',')]);  // eslint-disable-line react-hooks/exhaustive-deps

  const today = dayKey(now, tz); const md = today.slice(5);
  const winter = inSeason(md, season);
  const minute = localHM(now, tz);
  const st = status(evs, now.getTime(), minute, winter, wins);
  React.useEffect(() => { sdk()?.publishState?.('hydro-peak', 'peak', st.level === 'peak' ? 'now' : st.level === 'soon' ? 'soon' : 'none'); }, [st.level]);

  const hm = (m: number) => fmtTime(new Date(2000, 0, 1, Math.floor(m / 60), m % 60), undefined, tf).replace(':00', '');
  const span = (a: string, b: string) => { const ma = a.match(/\s?([AP]M)$/i), mb = b.match(/\s?([AP]M)$/i); return ma && mb && ma[1] === mb[1] ? `${a.replace(ma[0], '')}–${b}` : `${a}–${b}`; };
  const range = (w: Win) => span(hm(w.from), hm(w.to));
  const evWhen = (e: Ev) => {
    const s = new Date(e.datedebut), f = new Date(e.datefin);
    const d = dayKey(s, tz) === today ? 'today' : dayKey(s, tz) === dayKey(new Date(now.getTime() + 86400000), tz) ? 'tomorrow'
      : new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: tz }).format(s);
    return `${d} ${span(fmtTime(s, tz, tf).replace(':00', ''), fmtTime(f, tz, tf).replace(':00', ''))}`;
  };

  const c = COLORS[st.level];
  const title = st.level === 'peak' ? 'Peak event' : st.level === 'soon' ? 'Peak event coming' : st.level === 'window' ? 'High-demand hours' : 'Off-peak';
  const detail = st.level === 'peak' ? `until ${fmtTime(new Date(st.current!.datefin), tz, tf).replace(':00', '')}`
    : st.level === 'soon' ? evWhen(st.next!)
    : st.level === 'window' ? `until ${hm(st.win!.to)}`
    : winter && st.nextWin ? `until ${hm(st.nextWin.from)}${st.nextWinTomorrow ? ' tomorrow' : ''}`
    : 'all day';
  const price = !winter ? String(config.priceLow || RATES['rate-d'].low) : st.level === 'peak' ? priceHigh : priceLow;
  const tip = st.level === 'peak' ? 'Turn the heat down a couple of degrees; hold the dryer, dishwasher and oven.'
    : st.level === 'soon' ? 'Pre-heat the house and run laundry or dishes before it starts.'
    : st.level === 'window' ? 'No event declared — normal price, but go easy if you can.'
    : winter ? '' : `Peak season starts Dec 1 — in ${daysToSeason(today, season)} days`;

  // today's timeline: windows (amber, faint in summer) and event blocks (red)
  const evToday = evs.map((e) => {
    const s = new Date(e.datedebut), f = new Date(e.datefin);
    if (dayKey(s, tz) !== today && dayKey(f, tz) !== today) return null;
    return { from: dayKey(s, tz) === today ? localHM(s, tz) : 0, to: dayKey(f, tz) === today ? localHM(f, tz) : 1440 };
  }).filter(Boolean) as Win[];
  const pct = (m: number) => `${(m / 1440) * 100}%`;
  const dot = (col: string, size = '0.8em') => <span style={{ width: size, height: size, borderRadius: '50%', background: col, flexShrink: 0, boxShadow: `0 0 0 0.22em color-mix(in srgb, ${col} 22%, transparent)` }} />;

  return (
    <div style={frame(style)}>
      <Fit max={1.5} min={0.6}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55em' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.7em', minWidth: 0 }}>
        {dot(err ? ink(style, 0.3) : c)}
        <span style={{ fontSize: '1.1em', fontWeight: 600, whiteSpace: 'nowrap' }}>{err ? 'Hydro-Québec' : title}</span>
        <span style={{ fontSize: '0.8em', opacity: 0.55, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{err ? 'peak data unavailable' : detail}</span>
        {showPrices && !err && <span style={{ marginLeft: 'auto', fontSize: '0.75em', fontWeight: 600, color: c, whiteSpace: 'nowrap' }}>{price}{/¢$/.test(price) ? '/kWh' : ''}</span>}
      </div>

      <div style={{ position: 'relative', height: '0.55em', borderRadius: '999px', background: ink(style, 0.08), overflow: 'hidden' }}>
        {wins.map((w, i) => <div key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: pct(w.from), width: pct(w.to - w.from), background: winter ? '#f59e0b' : ink(style, 0.14), opacity: winter ? 0.55 : 1 }} />)}
        {evToday.map((w, i) => <div key={`e${i}`} style={{ position: 'absolute', top: 0, bottom: 0, left: pct(w.from), width: pct(w.to - w.from), background: '#dc2626' }} />)}
        <div style={{ position: 'absolute', top: '-0.2em', bottom: '-0.2em', left: pct(minute), width: '0.18em', marginLeft: '-0.09em', background: style.textColor || 'currentColor', borderRadius: '0.1em' }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: '1em', rowGap: '0.3em', fontSize: '0.65em', whiteSpace: 'nowrap', minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.45em' }}>{dot('#16a34a', '0.7em')}Off-peak</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.45em', opacity: winter ? 1 : 0.55 }}>{dot('#f59e0b', '0.7em')}Peak hours {wins.map(range).join(' & ')}{winter ? '' : ' (Dec–Mar)'}</span>
        {(st.next || st.current) && <span style={{ display: 'flex', alignItems: 'center', gap: '0.45em' }}>{dot('#dc2626', '0.7em')}{st.current ? 'Event now' : st.level === 'soon' ? 'Event announced' : `Next event ${evWhen(st.next!)}`}</span>}
      </div>
      {tip && <div style={{ fontSize: '0.65em', opacity: 0.55, lineHeight: 1.3 }}>{tip}</div>}
      </div>
      </Fit>
    </div>
  );
}

/** Always-on provider (mounted by the host even when no Hydro block is visible):
 *  publishes `season` = "winter" | "off" so a block can hide itself outside Dec–Mar. */
export function StateProvider({ demandedKeys, settings }: { demandedKeys: string[]; settings: Record<string, unknown> }) {
  const wants = demandedKeys.includes('season');
  const [hour, setHour] = React.useState(() => Math.floor(Date.now() / 3600000));
  React.useEffect(() => {
    if (!wants) { sdk()?.clearState?.('hydro-peak', 'season'); return; }
    const id = setInterval(() => setHour(Math.floor(Date.now() / 3600000)), 600000);
    return () => clearInterval(id);
  }, [wants]);
  React.useEffect(() => {
    if (!wants) return;
    const tz = sdk()?.getHostSettings?.()?.timezone;
    const md = dayKey(new Date(), tz).slice(5);
    sdk()?.publishState?.('hydro-peak', 'season', inSeason(md, String(settings?.season || '12-01..03-31')) ? 'winter' : 'off');
  }, [wants, hour, settings?.season]);
  return null;
}
