import { KalbMark } from './KalbMarks';

interface BootScreenProps {
  leaving: boolean;
}

/** Branded Kalb loading state shown while the app mounts. */
export function BootScreen({ leaving }: BootScreenProps) {
  return (
    <div className={`boot${leaving ? ' boot-leave' : ''}`} aria-hidden="true">
      <div className="boot-mark">
        <div className="boot-ring" />
        <KalbMark className="boot-k" />
      </div>
      <div className="boot-word">KALB CONSTRUCTION</div>
      <div className="boot-sub">PROJECT ATLAS</div>
      <div className="boot-bar">
        <div className="boot-bar-fill" />
      </div>
    </div>
  );
}
