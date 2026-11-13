# Buoy FM

**Isometric Parameter Matrix & Shortwave Ocean Telemetry Receiver**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/import?s=https%3A%2F%2Fgithub.com%2Felizabethrubel%2FBuoyFM)

Buoy FM transforms live marine meteorological data from NOAA National Data Buoy Center (NDBC) stations and Open-Meteo Marine into an interactive 5-plane isometric time-series dot-matrix visualizer (`Now · -1 Hr · -2 Hr · -3 Hr · -4 Hr`) and generative Web Audio shortwave synthesizer.

## Features

- **5-Plane Isometric Time-Series Stack (`Now` → `-4 Hr`)**: Compares the last 5 hours of buoy readings front-to-back using a unified visual grammar—bubble size for wave height (`WVHT`), directional wave & wind travel (`MWD`/`WDIR`), hollow target rings for wind chop (`WSPD`/`APD`), pulse tempo for wave period (`DPD`), and thermal color palettes (`WTMP`).
- **Global Longitude Spine**: Spatial station selector ordered around the globe by longitude starting from NW Hawaii (`51001`, `46001`, `46005`, `46026`, `42001`, `45001`, `41025`, `42058`, `44013`, `32012`, `62094`, `62105`, `63055`, `21418`, `55020`, `46035`).
- **Generative Web Audio Shortwave Synth**: Modulates pink/brown noise surf filters and thermal sine drones in real time using wave height, swell period, and water temperature.
- **Live Vercel Serverless NOAA Telemetry Proxy (`/api/buoy`)**: Fetches and merges real-time NOAA `.txt` packets (including 5-hour historical snapshots) and Open-Meteo Marine wave spectra with Vercel Edge caching (`s-maxage=300, stale-while-revalidate=600`), with instant fallback to embedded station telemetry.
- **Raw NOAA `.txt` Packet Inspector**: Inspect the underlying NDBC tabular telemetry rows and station notes.

## Deploying to Vercel

1. **One-Click Import**: Click the **Deploy with Vercel** button above or open [`vercel.com/new`](https://vercel.com/new) and import `elizabethrubel/BuoyFM`.
2. **Zero Build Configuration**: Leave **Framework Preset** as `Other` (no build command or environment variables required).
3. **Click Deploy**: Vercel serves `index.html` at the root and automatically provisions the `/api/buoy` serverless function for live NOAA telemetry.
