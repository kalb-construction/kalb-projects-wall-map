import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/oswald';
import '@fontsource-variable/inter';
import 'maplibre-gl/dist/maplibre-gl.css';
import 'mapbox-gl/dist/mapbox-gl.css';
import './styles/global.css';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { applyKioskInsets, applyRedOverride, CALIBRATE } from './lib/kiosk';
import RedCalibration from './components/RedCalibration';

// Publish the TV overscan inset before first paint so chrome never jumps.
applyKioskInsets();
// Before first paint, so no element is ever drawn in the old red.
applyRedOverride();
// Unlock page scrolling for the colour card, which is the one screen that
// is taller than the viewport. See .cal-mode in global.css.
if (CALIBRATE) document.documentElement.classList.add('cal-mode');

// A long press on a touch panel raises Chrome's context menu — "Save image
// as…", "Open in new tab" — sitting on the lobby wall with no keyboard and
// no obvious way to dismiss it. The app has no use for it either way.
window.addEventListener('contextmenu', (e) => e.preventDefault());

// Images are the one thing a stray drag can peel off the page and leave
// floating; the map handles its own drag gestures.
window.addEventListener('dragstart', (e) => {
  if ((e.target as HTMLElement)?.tagName === 'IMG') e.preventDefault();
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      {/* ?cal=1 is a colour card for the panel, not a view of the atlas.
          Swapping it in here rather than inside App means the map, the
          data fetch and every hook stay out of it entirely — the screen
          is meant to prove what the display does to a flat fill, so the
          less running behind it, the better the evidence. */}
      {CALIBRATE ? <RedCalibration /> : <App />}
    </ErrorBoundary>
  </React.StrictMode>
);
