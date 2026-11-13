import React, { useState } from 'react';
import {
  Camera,
  CameraOff,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  RotateCcw,
} from 'lucide-react';
import type { GestureCalibration, GestureOutput } from '../vision/HandGestureEngine';

interface WebcamGesturePanelProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  gestureEnabled: boolean;
  onToggleGesture: () => void;
  gestureOutput: GestureOutput;
  calibration: GestureCalibration;
  onChangeCalibration: (next: Partial<GestureCalibration>) => void;
  onRecalibrate: () => void;
}

export const WebcamGesturePanel: React.FC<WebcamGesturePanelProps> = ({
  videoRef,
  canvasRef,
  gestureEnabled,
  onToggleGesture,
  gestureOutput,
  calibration,
  onChangeCalibration,
  onRecalibrate,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [showCalibration, setShowCalibration] = useState(false);

  const getStatusDisplay = () => {
    switch (gestureOutput.status) {
      case 'tracking_2_hands':
        return { symbol: '●', label: 'Tracking · 2 Hands', tone: 'text-cyan-400' };
      case 'tracking_1_hand':
        return { symbol: '●', label: 'Tracking · 1 Hand', tone: 'text-cyan-400' };
      case 'paused_fist':
        return { symbol: '❚❚', label: 'Paused · Fist Lock', tone: 'text-amber-400' };
      case 'ready_no_hand':
        return { symbol: '○', label: 'Active · Awaiting Hand', tone: 'text-sky-300' };
      case 'initializing':
        return { symbol: '◌', label: 'Starting Vision AI', tone: 'text-sky-300' };
      case 'camera_denied':
        return { symbol: '✖', label: 'Camera Permission Denied', tone: 'text-rose-400' };
      case 'camera_unavailable':
        return { symbol: '✖', label: 'Camera Unavailable', tone: 'text-rose-400' };
      case 'model_error':
        return { symbol: '✖', label: 'Vision Model Error', tone: 'text-rose-400' };
      default:
        return { symbol: '○', label: 'Gesture Control Off', tone: 'text-slate-400' };
    }
  };

  const statusInfo = getStatusDisplay();
  const isError =
    gestureOutput.status === 'camera_denied' ||
    gestureOutput.status === 'camera_unavailable' ||
    gestureOutput.status === 'model_error';

  return (
    <aside
      className="fixed bottom-4 left-4 z-30 w-[264px] rounded-xl bg-[#080f1f]/92 border border-cyan-500/25 shadow-2xl overflow-hidden transition-all duration-200"
      aria-label="Hand gesture webcam panel"
    >
      {/* Header Row */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/90">
        <div className="flex items-center gap-2 min-w-0">
          {gestureEnabled && !isError ? (
            <Camera className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          ) : (
            <CameraOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          )}
          <span className={`text-xs font-medium truncate ${statusInfo.tone}`}>
            <span className="mr-1.5" aria-hidden="true">
              {statusInfo.symbol}
            </span>
            {statusInfo.label}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setShowCalibration((v) => !v)}
            className={`p-1.5 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
              showCalibration
                ? 'bg-cyan-500/20 text-cyan-300'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
            }`}
            title="Calibrate gesture sensitivity"
            aria-label="Toggle gesture calibration"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            aria-label={collapsed ? 'Expand webcam preview' : 'Collapse webcam preview'}
          >
            {collapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Body (keep video & canvas mounted so stream stays active even when collapsed) */}
      <div className={collapsed ? 'hidden' : 'block'}>
        {/* Video + Skeleton Overlay */}
        <div className="relative w-full aspect-[4/3] bg-[#040812] overflow-hidden">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`w-full h-full object-cover scale-x-[-1] transition-opacity duration-200 ${
              gestureEnabled && !isError ? 'opacity-85' : 'opacity-0'
            }`}
          />
          <canvas
            ref={canvasRef}
            width={256}
            height={192}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />

          {/* Inactive / Error state overlay */}
          {(!gestureEnabled || isError) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-[#060b17]/95">
              <CameraOff className="w-6 h-6 text-slate-500 mb-2" />
              <p className="text-xs font-medium text-slate-200 mb-1">
                {isError ? gestureOutput.gestureName : 'Webcam Tracking Off'}
              </p>
              <p className="text-[11px] text-slate-400 leading-snug mb-3">
                {gestureOutput.errorMessage || 'Enable gesture control to pilot the globe with your hands.'}
              </p>
              <button
                type="button"
                onClick={onToggleGesture}
                className="px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-xs font-medium hover:bg-cyan-500/30 transition-colors whitespace-nowrap"
              >
                {isError ? 'Retry Camera' : 'Enable Camera'}
              </button>
            </div>
          )}
        </div>

        {/* Detected Gesture Readout */}
        <div className="px-3 py-2.5 border-t border-slate-800/90 bg-[#070d1b]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-400">Detected Gesture</span>
            {gestureOutput.handsCount > 0 && (
              <span className="text-[11px] font-mono-tabular text-cyan-400">
                {gestureOutput.handsCount} {gestureOutput.handsCount === 1 ? 'Hand' : 'Hands'}
              </span>
            )}
          </div>
          <div className="text-sm font-display font-semibold text-cyan-200 truncate mt-0.5">
            {gestureOutput.gestureName}
          </div>
          <div className="text-[11px] text-slate-400 truncate mt-0.5">
            {gestureOutput.gestureDetail}
          </div>
        </div>

        {/* Calibration Controls */}
        {showCalibration && (
          <div className="px-3 py-3 border-t border-slate-800 bg-[#0a1326] space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-300">Gesture Sensitivity</span>
                <span className="font-mono-tabular text-cyan-300">
                  {calibration.sensitivity.toFixed(1)}×
                </span>
              </div>
              <input
                type="range"
                min={0.4}
                max={2.4}
                step={0.1}
                value={calibration.sensitivity}
                onChange={(e) => onChangeCalibration({ sensitivity: parseFloat(e.target.value) })}
                className="w-full telemetry-slider"
                aria-label="Gesture sensitivity"
              />
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-300">Anti-Shake Deadzone</span>
                <span className="font-mono-tabular text-cyan-300">
                  {Math.round(calibration.deadzone * 1000)}
                </span>
              </div>
              <input
                type="range"
                min={0.002}
                max={0.02}
                step={0.001}
                value={calibration.deadzone}
                onChange={(e) => onChangeCalibration({ deadzone: parseFloat(e.target.value) })}
                className="w-full telemetry-slider"
                aria-label="Anti-shake deadzone"
              />
            </div>

            <button
              type="button"
              onClick={onRecalibrate}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Recalibrate Tracking</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
