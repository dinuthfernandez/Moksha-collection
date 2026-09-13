from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


class CategoryOut(BaseModel):
    id: str
    name: str
    slug: str
    type: Literal["clothing", "accessories"]
    parent_id: Optional[str] = None
    image_url: Optional[str] = None
    display_order: int = 0
    is_active: bool = True


class SizeChartOut(BaseModel):
    id: str
    name: str
    slug: str
    icon_url: str
    chart_image_urls: list[str]
    display_order: int = 0


class AnnouncementOut(BaseModel):
    id: str
    message: str
    display_order: int = 0
    is_active: bool = True


class ContactIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    phone: Optional[str] = Field(default=None, max_length=40)
    subject: Optional[str] = Field(default=None, max_length=160)
    message: str = Field(min_length=1, max_length=4000)


class ContactOut(BaseModel):
    id: str


# ---------------------------------------------------------------------------
# Auth / customers
# ---------------------------------------------------------------------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(min_length=1, max_length=80)
    phone_country_code: str = Field(min_length=1, max_length=6)
    phone: str = Field(min_length=4, max_length=20)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class CustomerOut(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    phone_country_code: str
    phone: str
    created_at: str


class TokenOut(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    customer: CustomerOut


class CustomerUpdateIn(BaseModel):
    first_name: str = Field(min_length=1, max_length=80)
    last_name: str = Field(min_length=1, max_length=80)
    phone_country_code: str = Field(min_length=1, max_length=6)
    phone: str = Field(min_length=4, max_length=20)


# ---------------------------------------------------------------------------
# Delivery addresses (international-ready)
# ---------------------------------------------------------------------------
class AddressIn(BaseModel):
    label: str = Field(default="Home", max_length=40)
    full_name: str = Field(min_length=1, max_length=120)
    phone_country_code: str = Field(min_length=1, max_length=6)
    phone: str = Field(min_length=4, max_length=20)
    country_code: str = Field(min_length=2, max_length=2)
    country_name: str = Field(min_length=1, max_length=80)
    address_line1: str = Field(min_length=1, max_length=200)
    address_line2: Optional[str] = Field(default=None, max_length=200)
    city: str = Field(min_length=1, max_length=100)
    state_region: Optional[str] = Field(default=None, max_length=100)
    postal_code: Optional[str] = Field(default=None, max_length=20)
    delivery_notes: Optional[str] = Field(default=None, max_length=500)
    is_default: bool = False

    @field_validator("country_code")
    @classmethod
    def uppercase_country_code(cls, v: str) -> str:
        return v.upper()


class AddressOut(AddressIn):
    id: str
    customer_id: str
    created_at: str
