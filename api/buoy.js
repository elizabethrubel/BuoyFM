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
    const dataLines = lines.filter((l) => !l.startsWith('#')).slice(0, 60);

    const cols = headerLine
      .replace(/^#/, '')
      .trim()
      .split(/\s+/);

    const parsedRows = [];
    const merged = {};
    let timeUTC = null;

    for (const line of dataLines) {
      const parts = line.split(/\s+/);
      if (parts.length < 5) continue;
      const rowTimeUTC = `${parts[3]}:${parts[4]} UTC`;
      if (!timeUTC) {
        timeUTC = rowTimeUTC;
      }
      const rowObj = { timeUTC: rowTimeUTC };
      const yy = parseInt(parts[0], 10);
      const mm = parseInt(parts[1], 10) - 1;
      const dd = parseInt(parts[2], 10);
      const hh = parseInt(parts[3], 10);
      const min = parseInt(parts[4], 10);
      rowObj._ts = Date.UTC(yy, mm, dd, hh, min);

      cols.forEach((col, i) => {
        const val = parseNum(parts[i]);
        rowObj[col] = val;
        if ((merged[col] === undefined || merged[col] === null) && val !== null) {
          merged[col] = val;
        }
      });
      parsedRows.push(rowObj);
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

    // Build 5 hourly time-series snapshots [Now, -1h, -2h, -3h, -4h]
    const baseTs = parsedRows.length > 0 ? parsedRows[0]._ts : Date.now();
    const history = [0, 1, 2, 3, 4].map((hrOffset) => {
      const targetTs = baseTs - hrOffset * 3600 * 1000;
      // Find rows near targetTs (within +/- 45 min) to merge wave & wind readings
      const windowRows = parsedRows
        .slice()
        .sort((a, b) => Math.abs(a._ts - targetTs) - Math.abs(b._ts - targetTs))
        .slice(0, 6);

      const snap = {};
      for (const r of windowRows) {
        if (!snap.timeUTC) snap.timeUTC = r.timeUTC;
        for (const k of ['WVHT', 'DPD', 'APD', 'MWD', 'WDIR', 'WSPD', 'GST', 'WTMP', 'PRES']) {
          if (snap[k] == null && r[k] != null) snap[k] = r[k];
        }
      }

      return {
        offsetHours: hrOffset,
        label: hrOffset === 0 ? 'Now' : `-${hrOffset} Hr`,
        timeUTC: snap.timeUTC || timeUTC,
        wvht: snap.WVHT ?? merged.WVHT ?? null,
        dpd: snap.DPD ?? merged.DPD ?? null,
        apd: snap.APD ?? merged.APD ?? null,
        mwd: snap.MWD ?? merged.MWD ?? null,
        wdir: snap.WDIR ?? merged.WDIR ?? null,
        wspd: snap.WSPD ?? merged.WSPD ?? null,
        gst: snap.GST ?? merged.GST ?? null,
        wtmp: snap.WTMP ?? merged.WTMP ?? null,
      };
    });

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
      history,
      raw: [headerLine, ...dataLines.slice(0, 6)].filter(Boolean).join('\n'),
    });
  } catch (err) {
    return res.status(502).json({
      error: 'Unable to fetch live NOAA NDBC telemetry',
      message: err.message,
    });
  }
}
