"""
Skema Pydantic untuk ringkasan sesi dan interval postur.
Field yang TIDAK ada di sini (frame, gambar, landmark) ditolak otomatis oleh Pydantic.
"""
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, UUID4


class PostureIntervalIn(BaseModel):
    interval_index: int = Field(ge=0)
    upright_pct: float = Field(ge=0.0, le=100.0)
    alert_count: int = Field(ge=0, default=0)


class PostureIntervalOut(PostureIntervalIn):
    id: int
    model_config = {"from_attributes": True}


class SessionCreate(BaseModel):
    client_session_id: UUID4
    started_at: datetime
    ended_at: datetime
    focus_minutes: int = Field(gt=0)
    break_minutes: int = Field(ge=0, default=0)
    posture_score: float = Field(ge=0.0, le=100.0)
    alert_count: int = Field(ge=0, default=0)
    camera_mode: Literal["camera", "no_camera"] = "camera"
    intervals: list[PostureIntervalIn] = Field(default_factory=list)


class SessionOut(BaseModel):
    id: int
    client_session_id: str
    started_at: datetime
    ended_at: datetime
    focus_minutes: int
    break_minutes: int
    posture_score: float
    alert_count: int
    camera_mode: str
    created_at: datetime
    intervals: list[PostureIntervalOut] = []

    model_config = {"from_attributes": True}


class SessionListItem(BaseModel):
    """Versi ringkas untuk list sesi — tanpa intervals agar hemat bandwidth."""
    id: int
    client_session_id: str
    started_at: datetime
    ended_at: datetime
    focus_minutes: int
    posture_score: float
    alert_count: int
    camera_mode: str

    model_config = {"from_attributes": True}
