"""
Entry point Furai Backend.
Jalankan dengan: uvicorn app.main:app --reload
Dokumentasi API otomatis tersedia di: http://localhost:8000/docs
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine
from app.routers import auth, config, sessions

# Buat semua tabel saat startup (aman dijalankan berkali-kali)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Furai API",
    description=(
        "Backend untuk Furai — web app deteksi postur belajar. "
        "Server tidak menerima frame, gambar, atau koordinat landmark. "
        "Hanya ringkasan sesi yang disimpan."
    ),
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS: izinkan domain frontend mengakses API (NFR-14)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Daftarkan semua router
app.include_router(auth.router)
app.include_router(sessions.router)
app.include_router(config.router)


@app.get("/health", tags=["Health"])
def health_check():
    """Cek apakah server hidup. Dipakai saat deploy dan monitoring."""
    return {"status": "ok", "service": "furai-backend"}
