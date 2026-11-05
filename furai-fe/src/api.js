/**
 * api.js — semua komunikasi ke Furai Backend ada di sini.
 * Komponen React tidak perlu tahu URL atau token secara langsung.
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function getToken() {
  return localStorage.getItem('furai_token');
}

function saveToken(token) {
  localStorage.setItem('furai_token', token);
}

function clearToken() {
  localStorage.removeItem('furai_token');
}

/**
 * Wrapper fetch yang otomatis:
 * - Tambah header Content-Type: application/json
 * - Tambah Authorization: Bearer <token> bila ada
 * - Lempar error dengan pesan dari backend bila response bukan 2xx
 */
async function apiFetch(path, options = {}) {
  const token = getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  // Response 204 No Content (hapus akun) tidak punya body
  if (res.status === 204) return null;

  const data = await res.json();

  if (!res.ok) {
    // FastAPI mengembalikan { detail: "..." } untuk semua error
    const message = typeof data.detail === 'string'
      ? data.detail
      : JSON.stringify(data.detail);
    throw new Error(message);
  }

  return data;
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

/**
 * Daftar akun baru.
 * @returns {Promise<{id: number, email: string}>}
 */
export async function register(email, password) {
  return apiFetch('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

/**
 * Login. Menyimpan token ke localStorage secara otomatis.
 * @returns {Promise<{access_token: string, token_type: string}>}
 */
export async function login(email, password) {
  const data = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  saveToken(data.access_token);
  return data;
}

/**
 * Logout: hapus token dari localStorage.
 * Tidak perlu request ke backend karena JWT stateless.
 */
export function logout() {
  clearToken();
}

/**
 * Ambil profil user yang sedang login.
 * @returns {Promise<{id: number, email: string}>}
 */
export async function getMe() {
  return apiFetch('/api/auth/me');
}

/**
 * Hapus akun beserta semua data di server.
 * @param {string} password - Konfirmasi password
 */
export async function deleteAccount(password) {
  return apiFetch('/api/auth/me', {
    method: 'DELETE',
    body: JSON.stringify({ password }),
  });
}

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */

/**
 * Simpan ringkasan sesi ke server (hanya dipanggil bila user login).
 * Idempoten berkat client_session_id — aman diulang bila gagal jaringan.
 */
export async function saveSession(sessionData) {
  return apiFetch('/api/sessions', {
    method: 'POST',
    body: JSON.stringify(sessionData),
  });
}

/**
 * Ambil daftar sesi milik user yang login.
 * @param {number} page - Halaman (mulai dari 1)
 */
export async function getSessions(page = 1) {
  return apiFetch(`/api/sessions?page=${page}`);
}

/**
 * Ambil detail satu sesi beserta interval posturnya.
 */
export async function getSession(id) {
  return apiFetch(`/api/sessions/${id}`);
}

/* ------------------------------------------------------------------ */
/* Config & Stretches                                                  */
/* ------------------------------------------------------------------ */

/**
 * Ambil parameter deteksi postur dari server.
 * Bila gagal, gunakan nilai bawaan dari 02_deteksi_bungkuk.py.
 */
export async function getConfig() {
  try {
    return await apiFetch('/api/config');
  } catch {
    return {
      calibration_seconds: 5,
      threshold_down: 0.93,
      threshold_forward: 1.08,
      smoothing_frames: 10,
      alert_duration_seconds: 3,
      min_visibility: 0.5,
      default_focus_minutes: 25,
      default_break_minutes: 5,
    };
  }
}

/**
 * Ambil daftar gerakan peregangan dari server.
 * Bila gagal, kembalikan daftar bawaan.
 */
export async function getStretches() {
  try {
    return await apiFetch('/api/stretches');
  } catch {
    return [
      { id: 'neck-tilt', name: 'Miringkan Kepala', duration_seconds: 15 },
      { id: 'shoulder-roll', name: 'Putar Bahu', duration_seconds: 15 },
      { id: 'chest-open', name: 'Buka Dada', duration_seconds: 15 },
    ];
  }
}

/* ------------------------------------------------------------------ */
/* Utils                                                               */
/* ------------------------------------------------------------------ */

/** Cek apakah user sedang login (ada token di localStorage). */
export function isLoggedIn() {
  return Boolean(getToken());
}
