import React, { useEffect } from 'react';
import { X, Hand, MousePointer2, Sparkles } from 'lucide-react';

interface GestureHelpModalProps {
  open: boolean;
  onClose: () => void;
}

const HAND_GESTURES = [
  {
    name: 'One Finger Pointing',
    pose: 'Extend index finger only',
    effect: 'Move finger in any direction to smoothly rotate the globe 360°.',
  },
  {
    name: 'Two Fingers Together / Spread',
    pose: 'Extend index + middle fingers',
    effect: 'Bring fingers together to zoom out; spread them apart to zoom in.',
  },
  {
    name: 'Thumb & Index Pinch',
    pose: 'Pinch thumb & index tips together',
    effect: 'Grab and drag the Earth directly like a physical hologram.',
  },
  {
    name: 'Open Palm',
    pose: 'All 5 fingers open & steady',
    effect: 'Immediately brake and stop all globe rotation and momentum.',
  },
  {
    name: 'Closed Fist',
    pose: 'Curl all fingers into a fist',
    effect: 'Pause and lock all gesture interactions to prevent accidental motion.',
  },
  {
    name: 'Move Hand Left / Right',
    pose: 'Slide open/relaxed hand horizontally',
    effect: 'Rotate the globe smoothly east or west along longitude.',
  },
  {
    name: 'Move Hand Up / Down',
    pose: 'Raise or lower hand vertically',
    effect: 'Tilt the globe smoothly north or south across latitude.',
  },
  {
    name: 'Two-Hand Pinch',
    pose: 'Pinch thumb & index on both hands',
    effect: 'Move pinched hands apart to zoom in, or closer together to zoom out.',
  },
  {
    name: 'Two Open Hands Apart',
    pose: 'Both palms open, moving apart',
    effect: 'Zoom smoothly closer toward countries and cities.',
  },
  {
    name: 'Two Open Hands Closer',
    pose: 'Both palms open, moving together',
    effect: 'Zoom smoothly back out toward full planetary orbit.',
  },
  {
    name: 'Circular Finger Movement',
    pose: 'Trace a circle with index finger',
    effect: 'Engage continuous orbital rotation clockwise or counter-clockwise.',
  },
  {
    name: 'Swipe Gesture',
    pose: 'Quick flick of hand or finger',
    effect: 'Impart rapid inertial spin in the swipe direction.',
  },
];

export const GestureHelpModal: React.FC<GestureHelpModalProps> = ({ open, onClose }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gesture-help-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[86vh] flex flex-col rounded-xl bg-[#091020] border border-cyan-500/25 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <Hand className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 id="gesture-help-title" className="font-display text-lg font-semibold text-slate-100">
                Gesture & Navigation Guide
              </h2>
              <p className="text-xs text-slate-400">
                Real-time MediaPipe hand tracking · Mouse & touch controls always active
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            aria-label="Close gesture guide"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-sm font-semibold tracking-wide text-cyan-300">
                Webcam AI Hand Gestures
              </h3>
              <span className="text-xs text-slate-400">Keep hand 40–80 cm from camera</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {HAND_GESTURES.map((g) => (
                <div
                  key={g.name}
                  className="p-3.5 rounded-lg bg-[#0d172c] border border-slate-800/90 hover:border-cyan-500/35 transition-colors"
                >
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <span className="text-sm font-semibold text-slate-100">{g.name}</span>
                  </div>
                  <div className="text-xs text-cyan-400/90 mb-1.5">{g.pose}</div>
                  <p className="text-xs text-slate-300 leading-relaxed">{g.effect}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-[#0d172c] border border-slate-800/90">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-100 mb-2">
                <MousePointer2 className="w-4 h-4 text-cyan-400" />
                <span>Mouse & Touch Controls</span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-300">
                <li>Drag with mouse or one finger to rotate 360° with inertia</li>
                <li>Scroll wheel or two-finger pinch to zoom from orbit to city level</li>
                <li>Click any country or glowing city beacon to highlight & inspect</li>
              </ul>
            </div>

            <div className="p-4 rounded-lg bg-[#0d172c] border border-slate-800/90">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-100 mb-2">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>Tracking Calibration Tips</span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-300">
                <li>Face even front lighting and avoid strong backlighting behind your hands</li>
                <li>Form a Closed Fist at any time to pause tracking while resting</li>
                <li>Use the Sensitivity slider in the webcam panel to tune speed & smoothing</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="px-6 py-3.5 border-t border-slate-800 bg-[#070c18] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-cyan-500 text-slate-950 font-semibold text-xs hover:bg-cyan-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 whitespace-nowrap"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
};
