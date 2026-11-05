"""
Router konfigurasi: parameter deteksi dan daftar gerakan peregangan.
Endpoint ini publik — tidak perlu login (FR-30).
"""
from fastapi import APIRouter

from app.schemas.config import AppConfig, StretchItem

router = APIRouter(prefix="/api", tags=["Config"])


@router.get("/config", response_model=AppConfig)
def get_config():
    """
    Kembalikan parameter deteksi postur.
    Nilai default = parameter dari 02_deteksi_bungkuk.py.
    Idealnya dibaca dari database atau env agar bisa diubah tanpa deploy ulang.
    """
    return AppConfig()


@router.get("/stretches", response_model=list[StretchItem])
def get_stretches():
    """
    Daftar gerakan peregangan untuk stretch break (FR-11).
    Konten ini dapat dipindah ke database bila perlu diubah tanpa deploy ulang.
    """
    return [
        StretchItem(
            id="neck-tilt",
            name="Miringkan Kepala",
            description="Miringkan kepala ke kanan perlahan, tahan 5 detik. Ulangi ke kiri.",
            duration_seconds=15,
        ),
        StretchItem(
            id="shoulder-roll",
            name="Putar Bahu",
            description="Putar kedua bahu ke belakang sebanyak 5 kali, lalu ke depan 5 kali.",
            duration_seconds=15,
        ),
        StretchItem(
            id="chest-open",
            name="Buka Dada",
            description="Satukan tangan di belakang punggung, angkat sedikit, dan tahan 10 detik.",
            duration_seconds=15,
        ),
        StretchItem(
            id="spine-twist",
            name="Putar Punggung",
            description="Duduk tegak, putar badan ke kanan dengan tangan di sandaran kursi. Tahan 5 detik, ulangi ke kiri.",
            duration_seconds=15,
        ),
    ]
