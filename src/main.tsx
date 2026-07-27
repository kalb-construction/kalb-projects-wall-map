import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/oswald';
import '@fontsource-variable/inter';
import 'maplibre-gl/dist/maplibre-gl.css';
import './styles/global.css';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
