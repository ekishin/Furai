# Furai Backend

Backend FastAPI untuk web app deteksi postur belajar Furai.
Server **tidak menyimpan frame, gambar, atau koordinat landmark**.

## Cara Menjalankan (Development)

### 1. Siapkan environment

```bash
# Buat virtual environment (disarankan)
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Mac/Linux

pip install -r requirements.txt
```

### 2. Buat file .env

```bash
copy .env.example .env
```

Lalu edit `.env` dan ganti nilai berikut:
- `SECRET_KEY` — generate dengan `python -c "import secrets; print(secrets.token_hex(32))"`
- `ADMIN_KEY` — kunci untuk membaca rekap kuesioner

### 3. Jalankan server

```bash
uvicorn app.main:app --reload
```

Server berjalan di `http://localhost:8000`.
Dokumentasi API interaktif tersedia di `http://localhost:8000/docs`.

---

## Struktur Endpoint

| Metode | Path | Keterangan | Auth |
|--------|------|------------|------|
| GET | /health | Cek server hidup | - |
| GET | /api/config | Parameter deteksi postur | - |
| GET | /api/stretches | Daftar gerakan peregangan | - |
| POST | /api/auth/register | Buat akun | - |
| POST | /api/auth/login | Login, dapat token | - |
| GET | /api/auth/me | Profil user login | Token |
| DELETE | /api/auth/me | Hapus akun + semua data | Token |
| POST | /api/sessions | Simpan ringkasan sesi | Token |
| GET | /api/sessions | List sesi milik user | Token |
| GET | /api/sessions/{id} | Detail satu sesi | Token |
| POST | /api/feedback | Kirim kuesioner anonim | - |
| GET | /api/feedback/summary | Rekap kuesioner (tim) | Admin key |

---

## Cara Pakai Token di Frontend

Setelah login, simpan token dan kirim di setiap request yang butuh autentikasi:

```
Authorization: Bearer <access_token>
```

---

## Catatan Privasi

- Server **tidak pernah** menerima frame webcam, gambar, atau koordinat landmark.
- Yang tersimpan di server hanya: akun pengguna dan ringkasan sesi (skor, durasi, jumlah teguran).
- Seluruh deteksi postur berjalan di browser pengguna.
