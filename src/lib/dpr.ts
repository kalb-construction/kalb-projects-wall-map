/**
 * Cap the resolution the WebGL map renders at.
 *
 * The MapLibre engine takes this as a constructor option (`pixelRatio`),
 * but Mapbox GL has no equivalent — it reads window.devicePixelRatio
 * directly, every frame. So the only way to give both engines the same
 * cap is to clamp the property itself before the map is constructed.
 *
 * Why it matters: at dpr 2 an uncapped canvas renders (2 / 1.5)² ≈ 1.8×
 * the pixels of the capped one, per frame. That is the difference between
 * a smooth wheel-zoom and the stretched-frame blur of a GPU-bound map on
 * a 4K wall or a 150–200 % scaled Windows display.
 */
export const MAX_PIXEL_RATIO = 1.5;

export function clampDevicePixelRatio(max: number = MAX_PIXEL_RATIO): void {
  try {
    // Keep reading the real value through the native getter so monitor
    // moves still register — we only clamp, we don't freeze. Firefox keeps
    // the accessor on Window.prototype, Chromium on the window instance.
    const native = (
      Object.getOwnPropertyDescriptor(Window.prototype, 'devicePixelRatio') ??
      Object.getOwnPropertyDescriptor(window, 'devicePixelRatio')
    )?.get;
    if (native) {
      Object.defineProperty(window, 'devicePixelRatio', {
        configurable: true,
        get: () => Math.min(native.call(window) as number, max)
      });
      return;
    }
    // Exotic embedder with the property on the instance: freeze a clamped
    // snapshot instead.
    const now = window.devicePixelRatio || 1;
    if (now > max) {
      Object.defineProperty(window, 'devicePixelRatio', {
        configurable: true,
        get: () => max
      });
    }
  } catch {
    /* non-configurable — the map simply runs uncapped */
  }
}
