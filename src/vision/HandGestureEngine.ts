import { FilesetResolver, HandLandmarker, NormalizedLandmark } from '@mediapipe/tasks-vision';

export type TrackingStatus =
  | 'off'
  | 'initializing'
  | 'ready_no_hand'
  | 'tracking_1_hand'
  | 'tracking_2_hands'
  | 'paused_fist'
  | 'camera_denied'
  | 'camera_unavailable'
  | 'model_error';

export interface GestureCalibration {
  sensitivity: number; // 0.4 to 2.5 (default 1.0)
  deadzone: number;    // 0.002 to 0.025 (default 0.006)
}

export interface GestureOutput {
  status: TrackingStatus;
  gestureName: string;
  gestureDetail: string;
  handsCount: number;
  confidence: number;
  errorMessage?: string;
}

export interface GestureEarthBridge {
  applyDragRotate: (deltaYaw: number, deltaPitch: number) => void;
  applySwipeImpulse: (vx: number, vy: number) => void;
  setContinuousSpin: (spinVel: number) => void;
  applyZoomDelta: (deltaDist: number) => void;
  stopMotion: () => void;
  setGesturePaused: (paused: boolean) => void;
}

const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

function dist2D(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

interface HandAnalysis {
  wrist: { x: number; y: number };
  center: { x: number; y: number };
  indexTip: { x: number; y: number };
  thumbTip: { x: number; y: number };
  palmSize: number;
  thumbExtended: boolean;
  indexExtended: boolean;
  middleExtended: boolean;
  ringExtended: boolean;
  pinkyExtended: boolean;
  extendedCount: number;
  pinchRatio: number;      // thumbTip - indexTip / palmSize
  twoFingerRatio: number;  // indexTip - middleTip / palmSize
  isPinching: boolean;
  isFist: boolean;
  isOpenPalm: boolean;
  isOneFinger: boolean;
  isTwoFingers: boolean;
}

export class HandGestureEngine {
  private videoEl: HTMLVideoElement;
  private overlayCanvas: HTMLCanvasElement;
  private bridge: GestureEarthBridge;
  private onStateChange: (output: GestureOutput) => void;

  private handLandmarker: HandLandmarker | null = null;
  private mediaStream: MediaStream | null = null;
  private running = false;
  private rafId = 0;
  private lastVideoTime = -1;

  private calibration: GestureCalibration = {
    sensitivity: 1.0,
    deadzone: 0.006,
  };

  // Smoothing & temporal buffers
  private smoothedHands: Array<Array<{ x: number; y: number; z: number }>> = [];
  private prevSingleCenter: { x: number; y: number } | null = null;
  private prevIndexTip: { x: number; y: number } | null = null;
  private prevTwoFingerRatio: number | null = null;
  private prevTwoHandSpan: number | null = null;
  private prevPinchState = false;
  private indexTrail: Array<{ x: number; y: number; t: number }> = [];
  private lastSwipeMs = 0;
  private currentGestureName = 'Idle';
  private currentGestureDetail = 'Show hand to camera';
  private lastEmitMs = 0;

  constructor(
    videoEl: HTMLVideoElement,
    overlayCanvas: HTMLCanvasElement,
    bridge: GestureEarthBridge,
    onStateChange: (output: GestureOutput) => void
  ) {
    this.videoEl = videoEl;
    this.overlayCanvas = overlayCanvas;
    this.bridge = bridge;
    this.onStateChange = onStateChange;
  }

  public setCalibration(next: Partial<GestureCalibration>) {
    this.calibration = { ...this.calibration, ...next };
  }

  public resetTrackingBuffers() {
    this.smoothedHands = [];
    this.prevSingleCenter = null;
    this.prevIndexTip = null;
    this.prevTwoFingerRatio = null;
    this.prevTwoHandSpan = null;
    this.prevPinchState = false;
    this.indexTrail = [];
    this.bridge.setGesturePaused(false);
  }

  public async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.emitStatus('initializing', 'Initializing Vision AI', 'Loading MediaPipe hand tracking model', 0, 0);

    try {
      // 1. Request webcam stream
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        this.running = false;
        this.emitStatus(
          'camera_unavailable',
          'Camera Unavailable',
          'Browser does not expose mediaDevices.getUserMedia',
          0,
          0,
          'Webcam API is unavailable in this browser context. Mouse and touch controls remain active.'
        );
        return;
      }

      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user',
          },
          audio: false,
        });
      } catch (err) {
        this.running = false;
        const msg = err instanceof Error ? err.message : 'Camera permission denied';
        const isPermission = /denied|permission|notallowed/i.test(msg);
        this.emitStatus(
          isPermission ? 'camera_denied' : 'camera_unavailable',
          isPermission ? 'Camera Access Denied' : 'No Camera Detected',
          'Use mouse or touch to control globe',
          0,
          0,
          isPermission
            ? 'Webcam permission was denied. Enable camera access in browser settings to use hand gestures.'
            : 'No webcam device was found. Mouse and touch controls remain active.'
        );
        return;
      }

      if (!this.running) {
        this.stopStream();
        return;
      }

      this.videoEl.srcObject = this.mediaStream;
      await new Promise<void>((resolve) => {
        if (this.videoEl.readyState >= 2) {
          resolve();
        } else {
          this.videoEl.onloadedmetadata = () => resolve();
        }
      });
      await this.videoEl.play();

      // 2. Initialize MediaPipe HandLandmarker (local WASM + model with CDN fallback)
      if (!this.handLandmarker) {
        const vision = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
        try {
          this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: '/mediapipe/hand_landmarker.task',
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numHands: 2,
            minHandDetectionConfidence: 0.55,
            minHandPresenceConfidence: 0.55,
            minTrackingConfidence: 0.55,
          });
        } catch {
          // CPU delegate fallback if WebGL delegate unsupported
          this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: '/mediapipe/hand_landmarker.task',
              delegate: 'CPU',
            },
            runningMode: 'VIDEO',
            numHands: 2,
            minHandDetectionConfidence: 0.55,
            minHandPresenceConfidence: 0.55,
            minTrackingConfidence: 0.55,
          });
        }
      }

      if (!this.running) return;
      this.emitStatus('ready_no_hand', 'Awaiting Hand', 'Raise 1 or 2 hands in camera view', 0, 0);
      this.loop();
    } catch (err) {
      this.running = false;
      this.stopStream();
      const message = err instanceof Error ? err.message : 'Failed to initialize MediaPipe';
      this.emitStatus('model_error', 'Vision Model Error', message, 0, 0, message);
    }
  }

  public stop() {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    this.resetTrackingBuffers();
    this.stopStream();
    this.clearCanvas();
    this.emitStatus('off', 'Gesture Control Off', 'Mouse & touch controls active', 0, 0);
  }

  private stopStream() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((t) => t.stop());
      this.mediaStream = null;
    }
    if (this.videoEl) {
      this.videoEl.srcObject = null;
    }
  }

  private clearCanvas() {
    const ctx = this.overlayCanvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    }
  }

  private loop = () => {
    if (!this.running) return;

    if (
      this.handLandmarker &&
      this.videoEl.readyState >= 2 &&
      this.videoEl.currentTime !== this.lastVideoTime
    ) {
      this.lastVideoTime = this.videoEl.currentTime;
      const nowMs = performance.now();
      const result = this.handLandmarker.detectForVideo(this.videoEl, nowMs);
      this.processResults(result.landmarks || [], nowMs);
    }

    this.rafId = requestAnimationFrame(this.loop);
  };

  private smoothLandmarks(rawHands: NormalizedLandmark[][]): Array<Array<{ x: number; y: number; z: number }>> {
    const alpha = 0.45; // EMA smoothing prevents landmark jitter
    const nextSmoothed: Array<Array<{ x: number; y: number; z: number }>> = [];

    for (let h = 0; h < rawHands.length; h++) {
      const raw = rawHands[h];
      const prev = this.smoothedHands[h];
      const smoothedHand: Array<{ x: number; y: number; z: number }> = [];

      for (let i = 0; i < raw.length; i++) {
        // Mirror X coordinate so right hand movement on screen matches physical right
        const mx = 1 - raw[i].x;
        const my = raw[i].y;
        const mz = raw[i].z;

        if (prev && prev[i]) {
          smoothedHand.push({
            x: prev[i].x + (mx - prev[i].x) * alpha,
            y: prev[i].y + (my - prev[i].y) * alpha,
            z: prev[i].z + (mz - prev[i].z) * alpha,
          });
        } else {
          smoothedHand.push({ x: mx, y: my, z: mz });
        }
      }
      nextSmoothed.push(smoothedHand);
    }

    this.smoothedHands = nextSmoothed;
    return nextSmoothed;
  }

  private analyzeHand(lm: Array<{ x: number; y: number; z: number }>): HandAnalysis {
    const wrist = lm[0];
    const middleMcp = lm[9];
    const palmSize = Math.max(0.05, dist2D(wrist, middleMcp));

    const isFingerExtended = (tipIdx: number, pipIdx: number, mcpIdx: number) => {
      const dTipWrist = dist2D(lm[tipIdx], wrist);
      const dPipWrist = dist2D(lm[pipIdx], wrist);
      const dTipMcp = dist2D(lm[tipIdx], lm[mcpIdx]);
      return dTipWrist > dPipWrist * 1.12 && dTipMcp > palmSize * 0.42;
    };

    const thumbExtended =
      dist2D(lm[4], lm[17]) > palmSize * 0.92 && dist2D(lm[4], lm[5]) > palmSize * 0.42;
    const indexExtended = isFingerExtended(8, 6, 5);
    const middleExtended = isFingerExtended(12, 10, 9);
    const ringExtended = isFingerExtended(16, 14, 13);
    const pinkyExtended = isFingerExtended(20, 18, 17);

    const extendedCount =
      (thumbExtended ? 1 : 0) +
      (indexExtended ? 1 : 0) +
      (middleExtended ? 1 : 0) +
      (ringExtended ? 1 : 0) +
      (pinkyExtended ? 1 : 0);

    const pinchRatio = dist2D(lm[4], lm[8]) / palmSize;
    const twoFingerRatio = dist2D(lm[8], lm[12]) / palmSize;

    const pinchThreshold = this.prevPinchState ? 0.42 : 0.34;
    const isPinching = pinchRatio < pinchThreshold && !(ringExtended && pinkyExtended && middleExtended);
    const isFist = !indexExtended && !middleExtended && !ringExtended && !pinkyExtended && !thumbExtended;
    const isOpenPalm = indexExtended && middleExtended && ringExtended && pinkyExtended && thumbExtended;
    const isOneFinger = indexExtended && !middleExtended && !ringExtended && !pinkyExtended;
    const isTwoFingers = indexExtended && middleExtended && !ringExtended && !pinkyExtended;

    const center = {
      x: (wrist.x + lm[5].x + lm[9].x + lm[17].x) / 4,
      y: (wrist.y + lm[5].y + lm[9].y + lm[17].y) / 4,
    };

    return {
      wrist,
      center,
      indexTip: lm[8],
      thumbTip: lm[4],
      palmSize,
      thumbExtended,
      indexExtended,
      middleExtended,
      ringExtended,
      pinkyExtended,
      extendedCount,
      pinchRatio,
      twoFingerRatio,
      isPinching,
      isFist,
      isOpenPalm,
      isOneFinger,
      isTwoFingers,
    };
  }

  private processResults(rawHands: NormalizedLandmark[][], nowMs: number) {
    if (rawHands.length === 0) {
      this.resetTrackingBuffers();
      this.clearCanvas();
      this.currentGestureName = 'No Hand Detected';
      this.currentGestureDetail = 'Show 1 or 2 hands in camera frame';
      if (nowMs - this.lastEmitMs > 90) {
        this.lastEmitMs = nowMs;
        this.emitStatus('ready_no_hand', this.currentGestureName, this.currentGestureDetail, 0, 0);
      }
      return;
    }

    const hands = this.smoothLandmarks(rawHands);
    const analyses = hands.map((h) => this.analyzeHand(h));
    this.drawOverlay(hands, analyses);

    const sens = this.calibration.sensitivity;
    const dz = this.calibration.deadzone;

    let status: TrackingStatus = hands.length === 2 ? 'tracking_2_hands' : 'tracking_1_hand';
    let gestureName = 'Hand Detected';
    let gestureDetail = 'Move hand or form a gesture';

    // --- TWO-HAND GESTURES ---
    if (analyses.length === 2) {
      this.prevSingleCenter = null;
      this.prevIndexTip = null;
      this.prevTwoFingerRatio = null;
      this.indexTrail = [];
      this.bridge.setGesturePaused(false);

      const h1 = analyses[0];
      const h2 = analyses[1];
      const p1 = h1.isPinching ? h1.indexTip : h1.center;
      const p2 = h2.isPinching ? h2.indexTip : h2.center;
      const span = dist2D(p1, p2);

      if (this.prevTwoHandSpan !== null) {
        const dSpan = span - this.prevTwoHandSpan;
        const bothPinching = h1.isPinching && h2.isPinching;
        const bothOpen = h1.extendedCount >= 4 && h2.extendedCount >= 4;

        if (bothPinching) {
          gestureName = 'Two-Hand Pinch Zoom';
          if (Math.abs(dSpan) > dz * 0.7) {
            this.bridge.applyZoomDelta(-dSpan * 5.2 * sens);
            gestureDetail = dSpan > 0 ? 'Zooming in smoothly' : 'Zooming out smoothly';
          } else {
            gestureDetail = 'Move pinched hands apart or together';
          }
        } else if (bothOpen) {
          if (dSpan > dz * 0.8) {
            this.bridge.applyZoomDelta(-dSpan * 4.8 * sens);
            gestureName = 'Two Open Hands Apart';
            gestureDetail = 'Zooming in';
          } else if (dSpan < -dz * 0.8) {
            this.bridge.applyZoomDelta(-dSpan * 4.8 * sens);
            gestureName = 'Two Open Hands Closer';
            gestureDetail = 'Zooming out';
          } else {
            gestureName = 'Two Open Hands Ready';
            gestureDetail = 'Spread apart to zoom in, bring closer to zoom out';
          }
        } else {
          if (Math.abs(dSpan) > dz * 0.9) {
            this.bridge.applyZoomDelta(-dSpan * 4.2 * sens);
            gestureName = dSpan > 0 ? 'Two-Hand Zoom In' : 'Two-Hand Zoom Out';
            gestureDetail = 'Dual-hand distance scaling';
          } else {
            gestureName = 'Two Hands Active';
            gestureDetail = 'Pinch both hands or open palms to zoom';
          }
        }
      } else {
        gestureName = 'Two Hands Detected';
        gestureDetail = 'Move apart or closer to zoom';
      }

      this.prevTwoHandSpan = span;
      this.prevPinchState = h1.isPinching || h2.isPinching;
    } else {
      // --- SINGLE-HAND GESTURES ---
      this.prevTwoHandSpan = null;
      const h = analyses[0];

      // 1. Closed Fist -> Pause all interactions
      if (h.isFist) {
        this.bridge.setGesturePaused(true);
        this.prevSingleCenter = null;
        this.prevIndexTip = null;
        this.prevTwoFingerRatio = null;
        this.indexTrail = [];
        this.prevPinchState = false;
        status = 'paused_fist';
        gestureName = 'Closed Fist';
        gestureDetail = 'All globe interactions paused';
      } else {
        this.bridge.setGesturePaused(false);

        // 2. Open Palm -> Stop movement immediately
        if (h.isOpenPalm) {
          // Check for rapid swipe even with open palm
          const dx = this.prevSingleCenter ? h.center.x - this.prevSingleCenter.x : 0;
          const dy = this.prevSingleCenter ? h.center.y - this.prevSingleCenter.y : 0;
          const speed = Math.hypot(dx, dy);

          if (this.prevSingleCenter && speed > 0.065 / Math.max(0.6, sens) && nowMs - this.lastSwipeMs > 450) {
            this.lastSwipeMs = nowMs;
            this.bridge.applySwipeImpulse(dx * 55 * sens, dy * 45 * sens);
            gestureName = 'Swipe Gesture';
            gestureDetail = Math.abs(dx) >= Math.abs(dy)
              ? dx > 0 ? 'Quick spin right' : 'Quick spin left'
              : dy > 0 ? 'Quick tilt down' : 'Quick tilt up';
          } else {
            this.bridge.stopMotion();
            gestureName = 'Open Palm';
            gestureDetail = 'Globe movement stopped';
          }
          this.prevSingleCenter = h.center;
          this.prevIndexTip = null;
          this.prevTwoFingerRatio = null;
          this.indexTrail = [];
          this.prevPinchState = false;
        }
        // 3. Thumb & Index Pinch -> Grab & Drag Earth
        else if (h.isPinching && !h.isTwoFingers) {
          this.prevPinchState = true;
          this.prevTwoFingerRatio = null;
          this.indexTrail = [];

          const pinchPoint = {
            x: (h.thumbTip.x + h.indexTip.x) * 0.5,
            y: (h.thumbTip.y + h.indexTip.y) * 0.5,
          };

          if (this.prevSingleCenter) {
            const dx = pinchPoint.x - this.prevSingleCenter.x;
            const dy = pinchPoint.y - this.prevSingleCenter.y;
            if (Math.hypot(dx, dy) > dz * 0.55) {
              this.bridge.applyDragRotate(dx * 4.4 * sens, dy * 3.8 * sens);
            }
          }
          this.prevSingleCenter = pinchPoint;
          this.prevIndexTip = null;
          gestureName = 'Pinch Grab & Drag';
          gestureDetail = 'Dragging globe directly';
        }
        // 4. Two Fingers Together / Spread -> Zoom In & Zoom Out using distance
        else if (h.isTwoFingers) {
          this.prevPinchState = false;
          this.prevSingleCenter = null;
          this.prevIndexTip = null;
          this.indexTrail = [];

          const ratio = h.twoFingerRatio;
          if (this.prevTwoFingerRatio !== null) {
            const dRatio = ratio - this.prevTwoFingerRatio;
            if (Math.abs(dRatio) > 0.012) {
              this.bridge.applyZoomDelta(-dRatio * 1.45 * sens);
              gestureName = dRatio > 0 ? 'Two Fingers Spread · Zoom In' : 'Two Fingers Together · Zoom Out';
              gestureDetail = 'Controlling zoom via finger gap';
            } else if (ratio < 0.24) {
              // Fingers held tightly together -> steady zoom out
              this.bridge.applyZoomDelta(0.016 * sens);
              gestureName = 'Two Fingers Together';
              gestureDetail = 'Zooming out smoothly';
            } else if (ratio > 0.52) {
              // Fingers spread wide apart -> steady zoom in
              this.bridge.applyZoomDelta(-0.016 * sens);
              gestureName = 'Two Fingers Spread';
              gestureDetail = 'Zooming in smoothly';
            } else {
              gestureName = 'Two-Finger Zoom Ready';
              gestureDetail = 'Pinch fingers together to zoom out, spread to zoom in';
            }
          } else {
            gestureName = 'Two-Finger Zoom';
            gestureDetail = 'Adjust finger distance to zoom';
          }
          this.prevTwoFingerRatio = ratio;
        }
        // 5. One Finger Pointing -> Rotate, Circular Spin, or Swipe
        else if (h.isOneFinger) {
          this.prevPinchState = false;
          this.prevTwoFingerRatio = null;
          this.prevSingleCenter = null;

          const tip = h.indexTip;
          this.indexTrail.push({ x: tip.x, y: tip.y, t: nowMs });
          this.indexTrail = this.indexTrail.filter((p) => nowMs - p.t < 520);

          const dx = this.prevIndexTip ? tip.x - this.prevIndexTip.x : 0;
          const dy = this.prevIndexTip ? tip.y - this.prevIndexTip.y : 0;
          const stepDist = Math.hypot(dx, dy);

          // Check circular finger trajectory over ring buffer
          const circleDir = this.detectCircularMotion(this.indexTrail);

          if (this.prevIndexTip && stepDist > 0.068 / Math.max(0.6, sens) && nowMs - this.lastSwipeMs > 450) {
            this.lastSwipeMs = nowMs;
            this.bridge.applySwipeImpulse(dx * 58 * sens, dy * 46 * sens);
            gestureName = 'Swipe Gesture';
            gestureDetail = Math.abs(dx) >= Math.abs(dy)
              ? dx > 0 ? 'Swiped right' : 'Swiped left'
              : dy > 0 ? 'Swiped down' : 'Swiped up';
          } else if (circleDir !== 0) {
            this.bridge.setContinuousSpin(circleDir * 1.45 * sens);
            gestureName = 'Circular Finger Spin';
            gestureDetail = circleDir > 0 ? 'Rotating continuously clockwise' : 'Rotating continuously counter-clockwise';
          } else if (this.prevIndexTip && stepDist > dz) {
            this.bridge.applyDragRotate(dx * 4.2 * sens, dy * 3.6 * sens);
            gestureName = 'One-Finger Point';
            if (Math.abs(dx) > Math.abs(dy) * 1.4) {
              gestureDetail = dx > 0 ? 'Rotating right' : 'Rotating left';
            } else if (Math.abs(dy) > Math.abs(dx) * 1.4) {
              gestureDetail = dy > 0 ? 'Rotating down' : 'Rotating up';
            } else {
              gestureDetail = '360° free orbital rotation';
            }
          } else {
            gestureName = 'One-Finger Point';
            gestureDetail = 'Move finger or draw circle to spin';
          }

          this.prevIndexTip = tip;
        }
        // 6. General Hand Move (Left/Right, Up/Down, Swipe)
        else {
          this.prevPinchState = false;
          this.prevTwoFingerRatio = null;
          this.prevIndexTip = null;
          this.indexTrail = [];

          if (this.prevSingleCenter) {
            const dx = h.center.x - this.prevSingleCenter.x;
            const dy = h.center.y - this.prevSingleCenter.y;
            const speed = Math.hypot(dx, dy);

            if (speed > 0.065 / Math.max(0.6, sens) && nowMs - this.lastSwipeMs > 450) {
              this.lastSwipeMs = nowMs;
              this.bridge.applySwipeImpulse(dx * 55 * sens, dy * 45 * sens);
              gestureName = 'Swipe Gesture';
              gestureDetail = Math.abs(dx) >= Math.abs(dy)
                ? dx > 0 ? 'Quick horizontal spin right' : 'Quick horizontal spin left'
                : dy > 0 ? 'Quick vertical spin down' : 'Quick vertical spin up';
            } else if (speed > dz) {
              this.bridge.applyDragRotate(dx * 3.8 * sens, dy * 3.2 * sens);
              if (Math.abs(dx) > Math.abs(dy) * 1.35) {
                gestureName = dx > 0 ? 'Move Hand Right' : 'Move Hand Left';
                gestureDetail = 'Horizontal globe rotation';
              } else if (Math.abs(dy) > Math.abs(dx) * 1.35) {
                gestureName = dy > 0 ? 'Move Hand Down' : 'Move Hand Up';
                gestureDetail = 'Vertical globe rotation';
              } else {
                gestureName = 'Hand Orbit';
                gestureDetail = 'Rotating globe smoothly';
              }
            } else {
              gestureName = 'Hand Tracking Active';
              gestureDetail = 'Move hand or use finger gestures';
            }
          }
          this.prevSingleCenter = h.center;
        }
      }
    }

    this.currentGestureName = gestureName;
    this.currentGestureDetail = gestureDetail;

    if (nowMs - this.lastEmitMs > 70) {
      this.lastEmitMs = nowMs;
      this.emitStatus(status, gestureName, gestureDetail, hands.length, 0.94);
    }
  }

  private detectCircularMotion(trail: Array<{ x: number; y: number; t: number }>): number {
    if (trail.length < 10) return 0;

    let cx = 0;
    let cy = 0;
    for (const p of trail) {
      cx += p.x;
      cy += p.y;
    }
    cx /= trail.length;
    cy /= trail.length;

    let totalRadius = 0;
    let totalSweep = 0;
    for (let i = 0; i < trail.length - 1; i++) {
      const ax = trail[i].x - cx;
      const ay = trail[i].y - cy;
      const bx = trail[i + 1].x - cx;
      const by = trail[i + 1].y - cy;
      const rA = Math.hypot(ax, ay);
      const rB = Math.hypot(bx, by);
      totalRadius += rA;
      if (rA < 0.018 || rB < 0.018) continue;
      const cross = ax * by - ay * bx;
      const dot = ax * bx + ay * by;
      totalSweep += Math.atan2(cross, dot);
    }

    const avgRadius = totalRadius / trail.length;
    if (avgRadius < 0.025 || avgRadius > 0.25) return 0;
    if (Math.abs(totalSweep) > 1.45) {
      return totalSweep > 0 ? 1 : -1;
    }
    return 0;
  }

  private drawOverlay(
    hands: Array<Array<{ x: number; y: number; z: number }>>,
    analyses: HandAnalysis[]
  ) {
    const canvas = this.overlayCanvas;
    const w = canvas.width;
    const h = canvas.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, w, h);

    // Draw fingertip motion trail if pointing
    if (this.indexTrail.length > 2) {
      ctx.beginPath();
      ctx.moveTo(this.indexTrail[0].x * w, this.indexTrail[0].y * h);
      for (let i = 1; i < this.indexTrail.length; i++) {
        ctx.lineTo(this.indexTrail[i].x * w, this.indexTrail[i].y * h);
      }
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.55)';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Two-hand zoom line connector
    if (hands.length === 2) {
      const a = analyses[0].isPinching ? analyses[0].indexTip : analyses[0].center;
      const b = analyses[1].isPinching ? analyses[1].indexTip : analyses[1].center;
      ctx.beginPath();
      ctx.setLineDash([4, 4]);
      ctx.moveTo(a.x * w, a.y * h);
      ctx.lineTo(b.x * w, b.y * h);
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
      ctx.lineWidth = 1.8;
      ctx.stroke();
      ctx.setLineDash([]);
    }

    hands.forEach((lm, idx) => {
      const analysis = analyses[idx];
      const strokeColor = analysis.isFist
        ? 'rgba(245, 158, 11, 0.85)'
        : analysis.isPinching
          ? 'rgba(34, 211, 238, 0.95)'
          : 'rgba(56, 189, 248, 0.8)';

      // Bones
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      for (const [a, b] of HAND_CONNECTIONS) {
        ctx.moveTo(lm[a].x * w, lm[a].y * h);
        ctx.lineTo(lm[b].x * w, lm[b].y * h);
      }
      ctx.stroke();

      // Joints
      for (let i = 0; i < lm.length; i++) {
        const isTip = i === 4 || i === 8 || i === 12 || i === 16 || i === 20;
        const r = isTip ? 3.5 : 2;
        ctx.beginPath();
        ctx.arc(lm[i].x * w, lm[i].y * h, r, 0, Math.PI * 2);
        ctx.fillStyle = isTip ? '#67e8f9' : '#e0f2fe';
        ctx.fill();
      }

      // Highlight pinch contact ring
      if (analysis.isPinching) {
        const px = ((lm[4].x + lm[8].x) * 0.5) * w;
        const py = ((lm[4].y + lm[8].y) * 0.5) * h;
        ctx.beginPath();
        ctx.arc(px, py, 9, 0, Math.PI * 2);
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  }

  private emitStatus(
    status: TrackingStatus,
    gestureName: string,
    gestureDetail: string,
    handsCount: number,
    confidence: number,
    errorMessage?: string
  ) {
    this.onStateChange({
      status,
      gestureName,
      gestureDetail,
      handsCount,
      confidence,
      errorMessage,
    });
  }

  public dispose() {
    this.stop();
    if (this.handLandmarker) {
      this.handLandmarker.close();
      this.handLandmarker = null;
    }
  }
}
