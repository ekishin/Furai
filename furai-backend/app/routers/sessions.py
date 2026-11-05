"""
Router sesi: simpan dan ambil ringkasan sesi postur.
Server tidak menyimpan frame, gambar, atau koordinat landmark — hanya ringkasan.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.database import get_db
from app.models.session import PostureInterval, SessionSummary
from app.models.user import User
from app.schemas.session import SessionCreate, SessionListItem, SessionOut

router = APIRouter(prefix="/api/sessions", tags=["Sessions"])


@router.post("", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
def create_session(
    payload: SessionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Simpan ringkasan sesi ke server (FR-28).
    Idempoten: kalau client_session_id sudah ada, kembalikan data yang sudah tersimpan
    tanpa membuat duplikat — aman bila sinkronisasi diulang karena gagal jaringan.
    """
    client_id_str = str(payload.client_session_id)

    # Cek duplikat berdasarkan client_session_id
    existing = (
        db.query(SessionSummary)
        .filter(SessionSummary.client_session_id == client_id_str)
        .first()
    )
    if existing:
        # Pastikan yang mengakses adalah pemilik sesi
        if existing.user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bukan milikmu")
        return existing

    # Buat sesi baru
    session = SessionSummary(
        user_id=current_user.id,
        client_session_id=client_id_str,
        started_at=payload.started_at,
        ended_at=payload.ended_at,
        focus_minutes=payload.focus_minutes,
        break_minutes=payload.break_minutes,
        posture_score=payload.posture_score,
        alert_count=payload.alert_count,
        camera_mode=payload.camera_mode,
    )
    db.add(session)
    db.flush()  # dapat session.id sebelum commit

    # Simpan interval postur
    for iv in payload.intervals:
        db.add(PostureInterval(
            session_id=session.id,
            interval_index=iv.interval_index,
            upright_pct=iv.upright_pct,
            alert_count=iv.alert_count,
        ))

    db.commit()
    db.refresh(session)
    return session


@router.get("", response_model=list[SessionListItem])
def list_sessions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Ambil daftar sesi milik pengguna yang login, dengan paginasi.
    Urutkan dari yang terbaru.
    """
    offset = (page - 1) * page_size
    sessions = (
        db.query(SessionSummary)
        .filter(SessionSummary.user_id == current_user.id)
        .order_by(SessionSummary.started_at.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )
    return sessions


@router.get("/{session_id}", response_model=SessionOut)
def get_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Ambil detail satu sesi beserta interval posturnya.
    Hanya pemilik sesi yang boleh mengakses (NFR-16).
    """
    session = db.query(SessionSummary).filter(SessionSummary.id == session_id).first()

    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sesi tidak ditemukan")

    if session.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bukan milikmu")

    return session
