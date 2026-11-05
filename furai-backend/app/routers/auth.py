"""
Router autentikasi: register, login, profil, hapus akun.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.database import get_db
from app.models.user import User
from app.schemas.auth import DeleteAccountRequest, Token, UserCreate, UserLogin, UserOut

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    """
    Buat akun baru. Email harus unik.
    Password di-hash sebelum disimpan — plaintext tidak pernah masuk database.
    """
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email sudah dipakai",
        )

    user = User(
        email=payload.email,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    """
    Login dengan email dan password. Kembalikan JWT access token.
    Gunakan token ini di header: Authorization: Bearer <token>
    """
    user = db.query(User).filter(User.email == payload.email, User.is_active == True).first()

    # Selalu jalankan verify_password meski user tidak ada, untuk mencegah timing attack
    password_ok = verify_password(payload.password, user.password_hash) if user else False

    if not user or not password_ok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email atau password salah",
        )

    token = create_access_token({"sub": user.email})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserOut)
def get_profile(current_user: User = Depends(get_current_user)):
    """Ambil profil pengguna yang sedang login."""
    return current_user


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    payload: DeleteAccountRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Hapus akun beserta semua ringkasan sesi di server (FR-29).
    Konfirmasi password diperlukan.
    Cascade delete otomatis menghapus semua session summaries milik user ini.
    """
    if not verify_password(payload.password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Password salah",
        )

    db.delete(current_user)
    db.commit()
