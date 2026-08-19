import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/oswald';
import '@fontsource-variable/inter';
import 'maplibre-gl/dist/maplibre-gl.css';
import 'mapbox-gl/dist/mapbox-gl.css';
import './styles/global.css';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { applyKioskInsets } from './lib/kiosk';

// Publish the TV overscan inset before first paint so chrome never jumps.
applyKioskInsets();

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
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
