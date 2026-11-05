/**
 * postureDetector.js
 *
 * Port JavaScript dari algoritma 02_deteksi_bungkuk.py.
 * Seluruh deteksi berjalan di browser — tidak ada data yang dikirim ke server.
 *
 * Cara pakai:
 *   const detector = new PostureDetector(config);
 *   await detector.init();
 *   const result = await detector.detect(videoElement);
 *   detector.destroy();
 */

// Indeks landmark MediaPipe Pose yang kita pakai
const LM = {
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
};

export class PostureDetector {
  /**
   * @param {object} config - Parameter dari 02_deteksi_bungkuk.py
   */
  constructor(config = {}) {
    this.config = {
      thresholdDown: config.threshold_down ?? 0.93,       // BATAS_TURUN
      thresholdForward: config.threshold_forward ?? 1.08, // BATAS_MAJU
      smoothingFrames: config.smoothing_frames ?? 10,     // JUMLAH_SMOOTHING
      alertDuration: config.alert_duration_seconds ?? 3,  // DURASI_ALERT
      minVisibility: config.min_visibility ?? 0.5,        // MIN_VISIBILITY
    };

    this.pose = null;           // MediaPipe Pose instance
    this.baseline = null;       // Hasil kalibrasi
    this.history = [];          // Riwayat N frame terakhir (voting mayoritas)
    this.slouchStartTime = null;// Kapan mulai bungkuk
    this.ready = false;
  }

  /**
   * Inisialisasi MediaPipe Pose dari CDN.
   * Dipanggil sekali setelah konstruktor.
   */
  async init() {
    // Tunggu sampai script MediaPipe Pose tersedia di window
    await this._loadMediaPipe();

    this.pose = new window.Pose({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });

    this.pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

    // Hasil pose diterima via callback
    this.pose.onResults((results) => {
      this._lastResults = results;
    });

    this.ready = true;
  }

  /**
   * Load script MediaPipe dari CDN secara dinamis.
   * Kalau sudah ada di window, skip.
   */
  _loadMediaPipe() {
    if (window.Pose) return Promise.resolve();

    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js';
      script.crossOrigin = 'anonymous';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Gagal memuat MediaPipe Pose'));
      document.head.appendChild(script);
    });
  }

  /**
   * Proses satu frame dari video element.
   * @param {HTMLVideoElement} videoEl
   * @returns {Promise<DetectionResult>}
   */
  async detect(videoEl) {
    if (!this.ready || !this.pose) {
      return { status: 'not_ready', features: null };
    }

    if (!videoEl || videoEl.readyState < 2) {
      return { status: 'not_detected', features: null };
    }

    // Kirim frame ke MediaPipe — hasilnya masuk ke _lastResults via callback
    this._lastResults = null;
    await this.pose.send({ image: videoEl });

    const results = this._lastResults;
    if (!results?.poseLandmarks) {
      return { status: 'not_detected', features: null };
    }

    const features = this._extractFeatures(
      results.poseLandmarks,
      videoEl.videoWidth,
      videoEl.videoHeight
    );

    if (!features) {
      return { status: 'not_detected', features: null };
    }

    // Kalau belum kalibrasi, kembalikan fitur saja
    if (!this.baseline) {
      return { status: 'not_calibrated', features };
    }

    const isBad = this._classify(features);

    // Voting mayoritas dari N frame terakhir (JUMLAH_SMOOTHING)
    this.history.push(isBad ? 1 : 0);
    if (this.history.length > this.config.smoothingFrames) {
      this.history.shift();
    }

    const badVotes = this.history.reduce((a, b) => a + b, 0);
    const isSlouching =
      this.history.length === this.config.smoothingFrames &&
      badVotes > this.history.length / 2;

    // Hitung durasi bungkuk untuk DURASI_ALERT
    const now = Date.now();
    let slouchDuration = 0;

    if (isSlouching) {
      if (!this.slouchStartTime) this.slouchStartTime = now;
      slouchDuration = (now - this.slouchStartTime) / 1000;
    } else {
      this.slouchStartTime = null;
    }

    const shouldAlert = slouchDuration >= this.config.alertDuration;

    return {
      status: isSlouching ? 'slouching' : 'aligned',
      features,
      slouchDuration,
      shouldAlert,
      landmarks: results.poseLandmarks,
    };
  }

  /**
   * Ambil fitur postur dari landmark.
   * Sama persis dengan fungsi ambil_fitur() di 02_deteksi_bungkuk.py.
   *
   * @param {Array} landmarks - Array landmark dari MediaPipe
   * @param {number} w - Lebar frame
   * @param {number} h - Tinggi frame
   * @returns {object|null}
   */
  _extractFeatures(landmarks, w, h) {
    const { LEFT_EAR, RIGHT_EAR, LEFT_SHOULDER, RIGHT_SHOULDER } = LM;
    const ids = [LEFT_EAR, RIGHT_EAR, LEFT_SHOULDER, RIGHT_SHOULDER];

    // Cek visibilitas minimum semua landmark yang dibutuhkan
    for (const id of ids) {
      if ((landmarks[id]?.visibility ?? 0) < this.config.minVisibility) {
        return null;
      }
    }

    const p = (id) => ({
      x: landmarks[id].x * w,
      y: landmarks[id].y * h,
    });

    const shoulderLeft = p(LEFT_SHOULDER);
    const shoulderRight = p(RIGHT_SHOULDER);
    const earLeft = p(LEFT_EAR);
    const earRight = p(RIGHT_EAR);

    const dx = shoulderLeft.x - shoulderRight.x;
    const dy = shoulderLeft.y - shoulderRight.y;
    const shoulderWidth = Math.sqrt(dx * dx + dy * dy);

    if (shoulderWidth < 1) return null;

    const midShoulder = {
      x: (shoulderLeft.x + shoulderRight.x) / 2,
      y: (shoulderLeft.y + shoulderRight.y) / 2,
    };
    const midEar = {
      x: (earLeft.x + earRight.x) / 2,
      y: (earLeft.y + earRight.y) / 2,
    };

    return {
      // Makin kecil = kepala makin turun mendekati bahu
      jarakKepalaBahu: (midShoulder.y - midEar.y) / shoulderWidth,
      // Makin besar = badan makin maju ke kamera
      lebarBahuRel: shoulderWidth / w,
    };
  }

  /**
   * Klasifikasi postur berdasarkan baseline.
   * Sama dengan logika di 02_deteksi_bungkuk.py.
   *
   * @returns {boolean} true = bungkuk
   */
  _classify(features) {
    const turun =
      features.jarakKepalaBahu <
      this.baseline.jarakKepalaBahu * this.config.thresholdDown;

    const maju =
      features.lebarBahuRel >
      this.baseline.lebarBahuRel * this.config.thresholdForward;

    return turun || maju;
  }

  /**
   * Simpan baseline dari array sampel selama kalibrasi.
   * Dipanggil setelah kalibrasi selesai.
   *
   * @param {Array<object>} samples - Array fitur yang dikumpulkan selama kalibrasi
   */
  setBaseline(samples) {
    if (!samples || samples.length === 0) return;

    const avg = (key) =>
      samples.reduce((sum, s) => sum + s[key], 0) / samples.length;

    this.baseline = {
      jarakKepalaBahu: avg('jarakKepalaBahu'),
      lebarBahuRel: avg('lebarBahuRel'),
    };

    // Reset history setelah kalibrasi
    this.history = [];
    this.slouchStartTime = null;

    console.log('[PostureDetector] Baseline set:', this.baseline);
  }

  /**
   * Ambil baseline yang tersimpan (untuk ditampilkan di UI).
   */
  getBaseline() {
    return this.baseline;
  }

  /**
   * Reset baseline (untuk kalibrasi ulang).
   */
  resetBaseline() {
    this.baseline = null;
    this.history = [];
    this.slouchStartTime = null;
  }

  /**
   * Bersihkan resources MediaPipe.
   */
  destroy() {
    if (this.pose) {
      this.pose.close();
      this.pose = null;
    }
    this.ready = false;
  }
}

/**
 * @typedef {object} DetectionResult
 * @property {'aligned'|'slouching'|'not_detected'|'not_calibrated'|'not_ready'} status
 * @property {object|null} features - { jarakKepalaBahu, lebarBahuRel }
 * @property {number} [slouchDuration] - Berapa detik sudah bungkuk
 * @property {boolean} [shouldAlert] - Apakah sudah melewati DURASI_ALERT
 * @property {Array} [landmarks] - Raw landmarks dari MediaPipe
 */
