/**
 * usePostureCamera.js
 *
 * Custom hook yang mengelola seluruh siklus kamera + deteksi postur.
 * Memisahkan logika kamera dari komponen UI agar lebih bersih.
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { PostureDetector } from './postureDetector';
import { getConfig } from './api';

export function usePostureCamera({
  potatoMode = false,
  sensitivity = 'medium',
  isCalibrating = false,
  onPostureChange,   // callback(status, angle)
  onShouldAlert,     // callback() dipanggil saat bungkuk melewati DURASI_ALERT
}) {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraPermission, setCameraPermission] = useState('idle'); // idle | granted | denied
  const [detectorLoading, setDetectorLoading] = useState(false);
  const [detectorReady, setDetectorReady] = useState(false);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const detectLoopRef = useRef(null);
  const calibSamplesRef = useRef([]);

  /* ------------------------------------------------------------------ */
  /* Baseline persistence                                                 */
  /* ------------------------------------------------------------------ */
  const loadSavedBaseline = (detector) => {
    try {
      const saved = JSON.parse(localStorage.getItem('furai_baseline') || 'null');
      if (saved?.jarakKepalaBahu && saved?.lebarBahuRel) {
        detector.baseline = saved;
        console.log('[Posture] Baseline dimuat dari localStorage');
        return true;
      }
    } catch { /* abaikan data rusak */ }
    return false;
  };

  const saveBaseline = (detector) => {
    const baseline = detector.getBaseline();
    if (baseline) {
      localStorage.setItem('furai_baseline', JSON.stringify(baseline));
    }
  };

  /* ------------------------------------------------------------------ */
  /* Sensitivity mapping                                                  */
  /* ------------------------------------------------------------------ */
  const applySensitivity = (detector) => {
    const map = {
      low:    { thresholdDown: 0.88, thresholdForward: 1.13 },
      medium: { thresholdDown: 0.93, thresholdForward: 1.08 },
      high:   { thresholdDown: 0.97, thresholdForward: 1.04 },
    };
    Object.assign(detector.config, map[sensitivity] ?? map.medium);
  };

  /* ------------------------------------------------------------------ */
  /* Detection loop                                                       */
  /* ------------------------------------------------------------------ */
  const startLoop = useCallback(() => {
    const frameInterval = potatoMode ? 300 : 150;
    let lastFrameTime = 0;

    const loop = async (timestamp) => {
      detectLoopRef.current = requestAnimationFrame(loop);

      if (timestamp - lastFrameTime < frameInterval) return;
      lastFrameTime = timestamp;

      const detector = detectorRef.current;
      const video = videoRef.current;
      if (!detector || !video || video.readyState < 2) return;

      try {
        const result = await detector.detect(video);

        if (result.status === 'not_detected') {
          onPostureChange?.('out_of_frame', 0);
          return;
        }

        if (result.status === 'not_calibrated') {
          if (isCalibrating && result.features) {
            calibSamplesRef.current.push(result.features);
          }
          return;
        }

        const angle = result.features
          ? Math.round(Math.abs(1 - result.features.jarakKepalaBahu) * 90)
          : 0;

        onPostureChange?.(result.status, angle);

        if (result.shouldAlert && result.status === 'slouching') {
          onShouldAlert?.();
        }
      } catch (err) {
        console.warn('[DetectionLoop] Frame error:', err.message);
      }
    };

    detectLoopRef.current = requestAnimationFrame(loop);
  }, [potatoMode, isCalibrating, onPostureChange, onShouldAlert]);

  /* ------------------------------------------------------------------ */
  /* Start camera                                                         */
  /* ------------------------------------------------------------------ */
  const startCamera = async () => {
    try {
      setCameraPermission('idle');
      setDetectorLoading(true);

      // 1. Minta akses kamera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width:     { ideal: potatoMode ? 480 : 640 },
          height:    { ideal: potatoMode ? 360 : 480 },
          frameRate: { ideal: potatoMode ? 15 : 30 },
        },
      });
      streamRef.current = stream;

      // 2. Bind stream ke video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraActive(true);
      setCameraPermission('granted');

      // 3. Inisialisasi MediaPipe
      const config = await getConfig();
      const detector = new PostureDetector(config);
      await detector.init();

      // 4. Terapkan sensitivity & load baseline
      applySensitivity(detector);
      loadSavedBaseline(detector);

      detectorRef.current = detector;
      setDetectorReady(true);
      setDetectorLoading(false);

      // 5. Mulai detection loop
      startLoop();

    } catch (err) {
      console.error('[Camera] Gagal start:', err);
      setCameraPermission('denied');
      setCameraActive(false);
      setDetectorLoading(false);
    }
  };

  /* ------------------------------------------------------------------ */
  /* Stop camera                                                          */
  /* ------------------------------------------------------------------ */
  const stopCamera = () => {
    if (detectLoopRef.current) {
      cancelAnimationFrame(detectLoopRef.current);
      detectLoopRef.current = null;
    }
    if (detectorRef.current) {
      detectorRef.current.destroy();
      detectorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setDetectorReady(false);
  };

  /* ------------------------------------------------------------------ */
  /* Calibration                                                          */
  /* ------------------------------------------------------------------ */
  const startCalibration = (onDone) => {
    calibSamplesRef.current = [];
    let progress = 0;

    const interval = setInterval(() => {
      progress += 10;
      if (progress >= 100) {
        clearInterval(interval);

        if (detectorRef.current && calibSamplesRef.current.length > 0) {
          detectorRef.current.setBaseline(calibSamplesRef.current);
          saveBaseline(detectorRef.current);
        }

        onDone?.();
      }
    }, 500); // 5 detik total

    return () => clearInterval(interval); // cleanup
  };

  /* Cleanup saat unmount */
  useEffect(() => {
    return () => stopCamera();
  }, []);

  /* Update sensitivity saat berubah tanpa restart kamera */
  useEffect(() => {
    if (detectorRef.current) {
      applySensitivity(detectorRef.current);
    }
  }, [sensitivity]);

  return {
    videoRef,
    cameraActive,
    cameraPermission,
    detectorLoading,
    detectorReady,
    calibSamplesRef,
    startCamera,
    stopCamera,
    startCalibration,
    isBaselineLoaded: () => Boolean(detectorRef.current?.baseline),
  };
}
