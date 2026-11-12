const ALLOWED_STATIONS = new Set([
  '46035', // Bering Sea (Pribilof Islands, AK)
  '46001', // Gulf of Alaska (Kodiak Basin, AK)
  '63055', // Norwegian Sea (Haltenbanken, Norway)
  '45001', // Lake Superior (Mid-Superior, MI)
  '62105', // UK Celtic Sea (Seven Stones, UK)
  '46005', // West Washington (300 NM W of Aberdeen)
  '44013', // Boston Harbor (Massachusetts Bay)
  '62094', // Nazaré Canyon (Portuguese Atlantic)
  '46026', // San Francisco Bar (Golden Gate, CA)
  '21418', // Kuroshio Current (Offshore Tokyo, Japan)
  '41025', // Cape Hatteras (Diamond Shoals, NC)
  '42001', // Gulf of Mexico (Mid-Gulf, LA)
  '51001', // NW Hawaii (Kauai, HI)
  '42058', // Central Caribbean (South of Haiti)
  '55020', // Tasman Sea (Sydney Heads, Australia)
  '32012', // Drake Passage (Cape Horn, Southern Ocean)
]);

function parseNum(val) {
  if (val === undefined || val === null || val === 'MM') return null;
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : null;
}

async function fetchOpenMeteoTelemetry(id, lat, lon) {
  const [marineResp, weatherResp] = await Promise.all([
    fetch(
      `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&current=wave_height,wave_direction,wave_period,swell_wave_period,sea_surface_temperature&hourly=wave_height,wave_direction,wave_period,swell_wave_period,sea_surface_temperature&past_hours=6&forecast_hours=1`
    ),
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=ms&past_hours=6&forecast_hours=1`
    ),
  ]);

  if (!marineResp.ok) {
    throw new Error(`Open-Meteo Marine responded with ${marineResp.status}`);
  }

  const marine = await marineResp.json();
  const weather = weatherResp.ok ? await weatherResp.json() : {};

  const mCur = marine.current || {};
  const wCur = weather.current || {};
  const mHr = marine.hourly || {};
  const wHr = weather.hourly || {};
  const times = mHr.time || [];
  const lastIdx = Math.max(0, times.length - 1);

  const wvht = mCur.wave_height ?? null;
  const dpd = mCur.swell_wave_period ?? mCur.wave_period ?? null;
  const apd = mCur.wave_period ?? null;
  const mwd = mCur.wave_direction ?? null;
  const wtmp = mCur.sea_surface_temperature ?? null;
  const wspd = wCur.wind_speed_10m ?? null;
  const gst = wCur.wind_gusts_10m ?? null;
  const wdir = wCur.wind_direction_10m ?? null;
  const pres = wCur.surface_pressure ?? null;
  const atmp = wCur.temperature_2m ?? null;
  const timeUTC = (mCur.time ? `${mCur.time.slice(11, 16)} UTC` : 'LIVE UTC');

  const history = [0, 1, 2, 3, 4].map((hrOffset) => {
    const idx = Math.max(0, lastIdx - hrOffset);
    const tStr = times[idx] ? `${times[idx].slice(11, 16)} UTC` : timeUTC;
    return {
      offsetHours: hrOffset,
      label: hrOffset === 0 ? 'Now' : `-${hrOffset} Hr`,
      timeUTC: tStr,
      wvht: (mHr.wave_height && mHr.wave_height[idx]) ?? wvht,
      dpd:
        (mHr.swell_wave_period && mHr.swell_wave_period[idx]) ??
        (mHr.wave_period && mHr.wave_period[idx]) ??
        dpd,
      apd: (mHr.wave_period && mHr.wave_period[idx]) ?? apd,
      mwd: (mHr.wave_direction && mHr.wave_direction[idx]) ?? mwd,
      wdir: (wHr.wind_direction_10m && wHr.wind_direction_10m[idx]) ?? wdir,
      wspd: (wHr.wind_speed_10m && wHr.wind_speed_10m[idx]) ?? wspd,
      gst: (wHr.wind_gusts_10m && wHr.wind_gusts_10m[idx]) ?? gst,
      wtmp: (mHr.sea_surface_temperature && mHr.sea_surface_temperature[idx]) ?? wtmp,
    };
  });

  return {
    id,
    timeUTC,
    wvht,
    dpd,
    apd,
    mwd,
    wdir,
    wspd,
    gst,
    pres,
    ptdy: null,
    atmp,
    wtmp,
    history,
    raw: `[Open-Meteo Marine + Forecast @ ${lat}°, ${lon}°]\nTIME=${timeUTC} WVHT=${wvht}m DPD=${dpd}s APD=${apd}s MWD=${mwd}° WSPD=${wspd}m/s WTMP=${wtmp}°C PRES=${pres}hPa`,
  };
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
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        const fallbackData = await fetchOpenMeteoTelemetry(id, lat, lon);
        res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
        return res.status(200).json(fallbackData);
      }
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
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      try {
        const fallbackData = await fetchOpenMeteoTelemetry(id, lat, lon);
        res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
        return res.status(200).json(fallbackData);
      } catch (_) {}
    }
    return res.status(502).json({
      error: 'Unable to fetch live NOAA NDBC telemetry',
      message: err.message,
    });
  }
}
