# Buoy FM

**Isometric Parameter Matrix & Shortwave Ocean Telemetry Receiver**

Buoy FM transforms live marine meteorological data from NOAA National Data Buoy Center (NDBC) stations and Open-Meteo Marine into an interactive 5-plane isometric dot-matrix visualizer (`50 · 75 · 100 · 125 · 150`) and generative Web Audio shortwave synthesizer.

## Features

- **5-Plane Isometric Dot Matrix (`50`–`150`)**: Visualizes wind/gust turbulence (`WSPD`/`GST`), surface chop (`APD`), primary swell crest (`WVHT`), dominant wave period (`DPD`), and concentric thermal rings (`WTMP`).
- **L'Annuel Océanique Latitude Spine**: Spatial station selector ordered North-to-South across major Atlantic, Pacific, and Caribbean buoys (`46001`, `62105`, `46005`, `44013`, `46026`, `51001`, `42058`).
- **Generative Web Audio Shortwave Synth**: Modulates pink/brown noise surf filters and thermal sine drones in real time using wave height, swell period, and water temperature.
- **Raw NOAA `.txt` Packet Inspector**: Inspect the underlying NDBC tabular telemetry rows and station notes.
