import { useSyncExternalStore } from 'react';

/**
 * The camera bearing lives outside React.
 *
 * A rotating or orbiting map emits bearing updates continuously. Putting
 * that in App state re-rendered the whole tree (48-row index, legend,
 * dock, top bar) several times a second — the main cause of the UI
 * feeling clumsy while the map moved. Only the compass needle needs the
 * value, so it subscribes here and nothing else re-renders.
 */
let bearing = 0;
const listeners = new Set<() => void>();

export function setBearing(deg: number): void {
  // Quarter-degree granularity: plenty for a compass needle, and it keeps
  // identical frames from waking React at all.
  const next = Math.round(deg * 4) / 4;
  if (next === bearing) return;
  bearing = next;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

const getSnapshot = () => bearing;

export function useBearing(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
