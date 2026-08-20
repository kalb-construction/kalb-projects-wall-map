import { memo, useRef } from 'react';
import { useClock } from '../lib/useIdle';
import { KalbLockup } from './KalbMarks';

interface TopBarProps {
  totalCount: number;
  shownCount: number;
  cityCount: number;
  onSearch: () => void;
  /** Three taps on the Kalb mark — the kiosk has no address bar. */
  onToggleDiag: () => void;
}

const DAY = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MON = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'
];

function TopBarBase({
  totalCount,
  shownCount,
  cityCount,
  onSearch,
  onToggleDiag
}: TopBarProps) {
  const now = useClock();
  const taps = useRef<number[]>([]);

  /** Diagnostics need to be reachable on a display with no keyboard. */
  const onBrandTap = () => {
    const t = Date.now();
    taps.current = [...taps.current, t].filter((x) => t - x < 1500);
    if (taps.current.length >= 3) {
      taps.current = [];
      onToggleDiag();
    }
  };
  const hh = now.getHours() % 12 || 12;
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ap = now.getHours() >= 12 ? 'PM' : 'AM';

  return (
    <header className="topbar">
      <div className="topbar-left" onClick={onBrandTap}>
        <KalbLockup className="topbar-logo" />
        <div className="topbar-divider" />
        <div className="topbar-title">
          <span className="tt-main">PROJECT ATLAS</span>
          <span className="tt-sub">LAS VEGAS VALLEY &amp; BEYOND</span>
        </div>
      </div>
      <div className="topbar-right">
        <div className="topbar-stat">
          <span className="stat-num">{shownCount}</span>
          <span className="stat-label">
            of {totalCount} projects · {cityCount} cities
          </span>
        </div>
        <span className="topbar-sep" aria-hidden="true" />
        <button className="search-btn" onClick={onSearch} aria-label="Search projects">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              d="M10.5 3.8a6.7 6.7 0 1 1 0 13.4 6.7 6.7 0 0 1 0-13.4Zm4.9 11.6 4.6 4.6"
            />
          </svg>
          <span>Search</span>
        </button>
        <span className="topbar-sep" aria-hidden="true" />
        <div className="topbar-clock">
          <span className="clock-time">
            {hh}:{mm} <em>{ap}</em>
          </span>
          <span className="clock-date">
            {DAY[now.getDay()]} · {MON[now.getMonth()]} {now.getDate()}
          </span>
        </div>
      </div>
    </header>
  );
}

/** Memoized: only re-renders when its own props actually change. */
export const TopBar = memo(TopBarBase);
