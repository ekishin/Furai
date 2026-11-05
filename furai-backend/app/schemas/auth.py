"""
Skema Pydantic untuk autentikasi.
"""
from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(
        min_length=8,
        max_length=72,  # batas aman bcrypt
        description="Minimal 8 karakter, maksimal 72 karakter, boleh huruf dan angka",
        examples=["Belajar123"],
    )


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(
        min_length=8,
        max_length=72,
        description="Password akun kamu",
        examples=["Belajar123"],
    )


class UserOut(BaseModel):
    id: int
    email: str

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class DeleteAccountRequest(BaseModel):
    """Konfirmasi password diperlukan sebelum hapus akun (FR-29)."""
    password: str = Field(
        min_length=8,
        max_length=72,
        description="Konfirmasi password sebelum akun dihapus",
        examples=["Belajar123"],
    )
