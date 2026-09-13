from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field


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
