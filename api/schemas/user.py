import uuid
from pydantic import BaseModel, EmailStr, Field
from models.user import UserRole


class UserCreate(BaseModel):
    nombre: str
    apellido: str
    email: EmailStr
    role: UserRole = UserRole.CLIENTE


class UserRegister(BaseModel):
    nombre: str
    apellido: str
    email: EmailStr
    password: str = Field(min_length=8)


class UserUpdate(BaseModel):
    nombre: str | None = None
    apellido: str | None = None
    password: str | None = None
    is_active: bool | None = None


class UserResponse(BaseModel):
    id: uuid.UUID
    nombre: str
    apellido: str
    email: str
    role: UserRole
    is_active: bool
    must_change_password: bool

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    token: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)
