# Buoy FM

**Isometric Parameter Matrix & Shortwave Ocean Telemetry Receiver**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/import?s=https%3A%2F%2Fgithub.com%2Felizabethrubel%2FBuoyFM)

Buoy FM transforms live marine meteorological data from NOAA National Data Buoy Center (NDBC) stations and Open-Meteo Marine into an interactive 5-plane isometric dot-matrix visualizer (`50 · 75 · 100 · 125 · 150`) and generative Web Audio shortwave synthesizer.

## Features

- **5-Plane Isometric Dot Matrix (`50`–`150`)**: Visualizes wind/gust turbulence (`WSPD`/`GST`), surface chop (`APD`), primary swell crest (`WVHT`), dominant wave period (`DPD`), and concentric thermal rings (`WTMP`).
- **L'Annuel Océanique Latitude Spine**: Spatial station selector ordered North-to-South across major Atlantic, Pacific, and Caribbean buoys (`46001`, `62105`, `46005`, `44013`, `46026`, `51001`, `42058`).
- **Generative Web Audio Shortwave Synth**: Modulates pink/brown noise surf filters and thermal sine drones in real time using wave height, swell period, and water temperature.
- **Live Vercel Serverless NOAA Telemetry Proxy (`/api/buoy`)**: Fetches and merges real-time NOAA `.txt` packets and Open-Meteo Marine wave spectra with Vercel Edge caching (`s-maxage=300, stale-while-revalidate=600`), with instant fallback to embedded station telemetry.
- **Raw NOAA `.txt` Packet Inspector**: Inspect the underlying NDBC tabular telemetry rows and station notes.

## Deploying to Vercel

1. **One-Click Import**: Click the **Deploy with Vercel** button above or open [`vercel.com/new`](https://vercel.com/new) and import `elizabethrubel/BuoyFM`.
2. **Zero Build Configuration**: Leave **Framework Preset** as `Other` (no build command or environment variables required).
3. **Click Deploy**: Vercel serves `index.html` at the root and automatically provisions the `/api/buoy` serverless function for live NOAA telemetry.
