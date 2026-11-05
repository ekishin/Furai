"""
Model ringkasan sesi dan interval postur.
Server TIDAK menyimpan frame, gambar, atau koordinat landmark.
"""
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SessionSummary(Base):
    __tablename__ = "session_summaries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)

    # ID unik yang dibuat browser — mencegah duplikat saat sinkronisasi diulang (FR-28)
    client_session_id: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)

    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ended_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    focus_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    break_minutes: Mapped[int] = mapped_column(Integer, default=0)

    # Skor 0–100: persentase waktu tegak dari total waktu terdeteksi (FR-14)
    posture_score: Mapped[float] = mapped_column(Float, nullable=False)
    alert_count: Mapped[int] = mapped_column(Integer, default=0)

    # "camera" atau "no_camera"
    camera_mode: Mapped[str] = mapped_column(String, default="camera")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    user: Mapped["User"] = relationship("User", back_populates="sessions")
    intervals: Mapped[list["PostureInterval"]] = relationship(
        "PostureInterval", back_populates="session", cascade="all, delete-orphan"
    )


class PostureInterval(Base):
    """
    Skor postur per interval waktu dalam satu sesi — untuk grafik (FR-15).
    Bukan sampel mentah; tidak ada koordinat atau gambar.
    """
    __tablename__ = "posture_intervals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("session_summaries.id"), nullable=False
    )
    interval_index: Mapped[int] = mapped_column(Integer, nullable=False)

    # Persentase waktu tegak dalam interval ini (0–100)
    upright_pct: Mapped[float] = mapped_column(Float, nullable=False)
    alert_count: Mapped[int] = mapped_column(Integer, default=0)

    session: Mapped["SessionSummary"] = relationship(
        "SessionSummary", back_populates="intervals"
    )
