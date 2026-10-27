from pydantic import BaseModel, EmailStr, Field


class SetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr
