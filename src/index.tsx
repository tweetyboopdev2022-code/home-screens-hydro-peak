import React from 'react';
import type { PluginComponentProps } from './hs-plugin';
import { frame, ink, caps, Icon, I, sdk, useNow, fmtTime, dayKey } from './ui';

type Ev = { offre: string; datedebut: string; datefin: string };
const NAMES: Record<string, string> = { 'CPC-D': 'Winter Credit', 'TPC-DPC': 'Flex D' };
const URL_BASE = 'https://donnees.hydroquebec.com/api/explore/v2.1/catalog/datasets/evenements-pointe/records';

export function upcoming(evs: Ev[], now: Date): Ev[] {
  return evs.filter((e) => new Date(e.datefin).getTime() > now.getTime()).sort((a, b) => +new Date(a.datedebut) - +new Date(b.datedebut));
}

export default function HydroPeak({ config, style, timezone: tz, ...rest }: PluginComponentProps & { timeFormat?: string }) {
  const now = useNow(60000);
  const offers = String(config.offers || 'CPC-D, TPC-DPC').split(',').map((s) => s.trim()).filter(Boolean);
  const accent = String(config.accentColor || '#ea580c');
  const [evs, setEvs] = React.useState<Ev[] | null>(null);
  const [err, setErr] = React.useState(false);
  const tick = Math.floor(now.getTime() / 900000);
  React.useEffect(() => { (async () => {
    try {
      const where = `offre in (${offers.map((o) => `"${o}"`).join(',')})`;
      const url = `${URL_BASE}?where=${encodeURIComponent(where)}&order_by=${encodeURIComponent('datedebut desc')}&limit=20`;
      const res: Response = await sdk().pluginFetch('hydro-peak', { url, cacheTtlMs: 900000 });
      if (!res.ok) throw new Error(String(res.status));
      const j = await res.json(); setEvs(j.results ?? []); setErr(false);
    } catch { setErr(true); }
  })(); }, [tick, offers.join(',')]);  // eslint-disable-line react-hooks/exhaustive-deps

  const up = upcoming(evs ?? [], now);
  const cur = up.find((e) => new Date(e.datedebut).getTime() <= now.getTime());
  const next = cur ?? up[0];
  const state = cur ? 'now' : next && new Date(next.datedebut).getTime() - now.getTime() < 36 * 3600000 ? 'soon' : 'none';
  React.useEffect(() => { sdk()?.publishState?.('hydro-peak', 'peak', state); }, [state]);
  const tf = (rest as any).timeFormat;
  const when = (e: Ev) => {
    const s = new Date(e.datedebut), f = new Date(e.datefin);
    const d = dayKey(s, tz) === dayKey(now, tz) ? 'Today' : dayKey(s, tz) === dayKey(new Date(now.getTime() + 86400000), tz) ? 'Tomorrow' : new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'short', day: 'numeric', timeZone: tz }).format(s);
    return `${d} ${fmtTime(s, tz, tf)}–${fmtTime(f, tz, tf)}`;
  };
  const m = now.getMonth(); const season = m === 11 || m <= 2;
  const color = state === 'none' ? ink(style, 0.45) : accent;

  return (
    <div style={frame(style, { flexDirection: 'row', alignItems: 'center', gap: '0.9em', ...(state !== 'none' ? { background: `color-mix(in srgb, ${accent} 10%, ${style.backgroundColor && style.backgroundColor !== 'transparent' ? style.backgroundColor : 'transparent'})` } : {}) })}>
      <div style={{ width: '2.8em', height: '2.8em', borderRadius: '50%', background: `color-mix(in srgb, ${state === 'none' ? 'gray' : accent} 14%, transparent)`, color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon d={I.bolt} size="1.4em" stroke={1.8} /></div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={caps}>Hydro-Québec peak{next ? ` · ${NAMES[next.offre] ?? next.offre}` : ''}</div>
        {err ? <div style={{ fontSize: '0.9em', opacity: 0.6 }}>Peak events unavailable right now</div>
          : state === 'none' ? <div style={{ fontSize: '1.1em', fontWeight: 500, opacity: 0.7 }}>{next ? `Next: ${when(next)}` : season ? 'No peak events scheduled' : 'Peak season runs Dec 1 – Mar 31'}</div>
          : (
            <>
              <div style={{ fontSize: '1.5em', fontWeight: 600, color: accent, lineHeight: 1.15 }}>{cur ? `Peak now until ${fmtTime(new Date(cur.datefin), tz, tf)}` : `Peak ${when(next!)}`}</div>
              <div style={{ fontSize: '0.75em', opacity: 0.65, marginTop: '0.2em' }}>{cur ? 'Lower the heat a few degrees; hold the dryer, dishwasher and oven until after.' : 'Pre-heat the house before it starts; run laundry and dishes before or after.'}</div>
            </>
          )}
      </div>
    </div>
  );
}
