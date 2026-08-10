import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Emits dist/version.json carrying the entry chunk's content-hashed
 * filename. The running app polls it and reloads when the value changes,
 * so the lobby display and anyone's installed desktop app pick up a
 * deploy without being manually restarted (see src/lib/version.ts).
 *
 * Using the content hash rather than a build timestamp means a redeploy
 * of identical code does NOT trigger a reload.
 */
function versionManifest(): Plugin {
  return {
    name: 'kalb-version-manifest',
    generateBundle(_options, bundle) {
      const entry = Object.values(bundle).find(
        (c) => c.type === 'chunk' && c.isEntry
      );
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: `${JSON.stringify({ build: entry?.fileName ?? 'dev' })}\n`
      });
    }
  };
}

// base './' so the built bundle can be served from any path (kiosk file
// server, nginx subfolder, or GitHub Pages) without configuration.
export default defineConfig({
  base: './',
  plugins: [react(), versionManifest()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 0
  }
});
