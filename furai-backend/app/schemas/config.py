"""
Skema untuk endpoint /api/config dan /api/stretches.
Nilai default diambil langsung dari parameter 02_deteksi_bungkuk.py.
"""
from pydantic import BaseModel


class AppConfig(BaseModel):
    # Parameter deteksi — dari 02_deteksi_bungkuk.py
    calibration_seconds: int = 5          # DURASI_KALIBRASI
    threshold_down: float = 0.93          # BATAS_TURUN
    threshold_forward: float = 1.08       # BATAS_MAJU
    smoothing_frames: int = 10            # JUMLAH_SMOOTHING
    alert_duration_seconds: int = 3       # DURASI_ALERT
    min_visibility: float = 0.5           # MIN_VISIBILITY

    # Parameter sesi Pomodoro
    default_focus_minutes: int = 25
    default_break_minutes: int = 5


class StretchItem(BaseModel):
    id: str
    name: str
    description: str
    duration_seconds: int
    illustration_url: str | None = None
