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

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
