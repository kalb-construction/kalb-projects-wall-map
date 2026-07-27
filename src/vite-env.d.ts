/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Google Maps Platform API key with the Map Tiles API enabled. */
  readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  /** Mapbox public access token (pk.…) — switches to the Mapbox engine. */
  readonly VITE_MAPBOX_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
