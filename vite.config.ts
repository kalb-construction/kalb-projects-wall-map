import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so the built bundle can be served from any path (kiosk file
// server, nginx subfolder, or GitHub Pages) without configuration.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 0
  }
});
