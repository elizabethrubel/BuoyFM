const ALLOWED_STATIONS = new Set([
  '46001',
  '62105',
  '46005',
  '44013',
  '46026',
  '51001',
  '42058',
]);

function parseNum(val) {
  if (val === undefined || val === null || val === 'MM') return null;
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : null;
}

export default async function handler(req, res) {
  const id = String(req.query.id || '46001').trim();
  if (!ALLOWED_STATIONS.has(id) && !/^[0-9A-Za-z]{5}$/.test(id)) {
    return res.status(400).json({ error: 'Invalid station ID' });
  }

  const lat = parseFloat(req.query.lat);
  const lon = parseFloat(req.query.lon);

  try {
    const noaaUrl = `https://www.ndbc.noaa.gov/data/realtime2/${id}.txt`;
    const noaaResp = await fetch(noaaUrl, {
      headers: { 'User-Agent': 'BuoyFM/1.0 (Vercel Serverless Telemetry Receiver)' },
    });

    if (!noaaResp.ok) {
      throw new Error(`NOAA NDBC responded with ${noaaResp.status}`);
    }

    const text = await noaaResp.text();
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const headerLine = lines.find((l) => l.startsWith('#YY')) || '';
    const dataLines = lines.filter((l) => !l.startsWith('#')).slice(0, 12);

    const cols = headerLine
      .replace(/^#/, '')
      .trim()
      .split(/\s+/);

    const merged = {};
    let timeUTC = null;

    for (const line of dataLines) {
      const parts = line.split(/\s+/);
      if (parts.length < 5) continue;
      if (!timeUTC) {
        timeUTC = `${parts[3]}:${parts[4]} UTC`;
      }
      cols.forEach((col, i) => {
        if (merged[col] === undefined || merged[col] === null) {
          const val = parseNum(parts[i]);
          if (val !== null) merged[col] = val;
        }
      });
    }

    // Enrich missing wave spectra from Open-Meteo Marine if coordinates are provided
    if (
      (merged.WVHT == null || merged.DPD == null || merged.APD == null) &&
      Number.isFinite(lat) &&
      Number.isFinite(lon)
    ) {
      try {
        const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&current=wave_height,wave_direction,wave_period,swell_wave_period`;
        const marineResp = await fetch(marineUrl);
        if (marineResp.ok) {
          const marineJson = await marineResp.json();
          const cur = marineJson.current || {};
          if (merged.WVHT == null && cur.wave_height != null) merged.WVHT = cur.wave_height;
          if (merged.DPD == null && (cur.swell_wave_period ?? cur.wave_period) != null) {
            merged.DPD = cur.swell_wave_period ?? cur.wave_period;
          }
          if (merged.APD == null && cur.wave_period != null) merged.APD = cur.wave_period;
          if (merged.MWD == null && cur.wave_direction != null) merged.MWD = cur.wave_direction;
        }
      } catch (_) {
        // Ignore Open-Meteo fallback errors
      }
    }

    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    return res.status(200).json({
      id,
      timeUTC,
      wvht: merged.WVHT ?? null,
      dpd: merged.DPD ?? null,
      apd: merged.APD ?? null,
      mwd: merged.MWD ?? null,
      wdir: merged.WDIR ?? null,
      wspd: merged.WSPD ?? null,
      gst: merged.GST ?? null,
      pres: merged.PRES ?? null,
      ptdy: merged.PTDY ?? null,
      atmp: merged.ATMP ?? null,
      wtmp: merged.WTMP ?? null,
      raw: [headerLine, ...dataLines.slice(0, 4)].filter(Boolean).join('\n'),
    });
  } catch (err) {
    return res.status(502).json({
      error: 'Unable to fetch live NOAA NDBC telemetry',
      message: err.message,
    });
  }
}
