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


class ProductOut(BaseModel):
    id: str
    zoho_item_id: Optional[str] = None
    category_slug: Optional[str] = None
    name: str
    slug: str
    description: Optional[str] = None
    price: float = 0
    compare_at_price: Optional[float] = None
    is_active: bool = True
    is_new_arrival: bool = False
    is_on_sale: bool = False
    is_under_5bhd: bool = False
    stock_quantity: int = 0
    image_url: Optional[str] = None
    zoho_sku: Optional[str] = None
    brand: Optional[str] = None
    length: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    weight: Optional[float] = None
    dimension_unit: Optional[str] = None
    weight_unit: Optional[str] = None
    last_synced_at: Optional[str] = None
    created_at: Optional[str] = None


class ProductStockAdjustIn(BaseModel):
    product_id: str
    quantity: int = Field(default=1, ge=1)


class ProductListOut(BaseModel):
    items: list[ProductOut]
    total: int
    page: int
    page_size: int
    total_pages: int


class OrderItemIn(BaseModel):
    product_id: str
    quantity: int = Field(default=1, ge=1)


class OrderIn(BaseModel):
    customer_name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=4, max_length=20)
    email: Optional[str] = Field(default=None, max_length=200)
    address: Optional[str] = Field(default=None, max_length=500)
    city: Optional[str] = Field(default=None, max_length=120)
    notes: Optional[str] = Field(default=None, max_length=1000)
    delivery_type: Literal["bahrain", "gcc", "international"] = "bahrain"
    items: list[OrderItemIn] = Field(min_length=1)


class OrderOut(BaseModel):
    id: str
    total_amount: float
    subtotal_amount: float = 0
    delivery_charge: float = 0
    delivery_type: Optional[str] = None
    status: str
    zoho_invoice_id: Optional[str] = None
    zoho_invoice_number: Optional[str] = None
    created_at: Optional[str] = None


class OrderItemOut(BaseModel):
    id: str
    product_id: Optional[str] = None
    product_name: Optional[str] = None
    product_image_url: Optional[str] = None
    quantity: int
    price: float


class OrderDetailOut(BaseModel):
    id: str
    customer_name: str
    phone: str
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    notes: Optional[str] = None
    subtotal_amount: float = 0
    delivery_charge: float = 0
    delivery_type: Optional[str] = None
    total_amount: float
    status: str
    return_status: str = "none"
    return_requested_at: Optional[str] = None
    return_completed_at: Optional[str] = None
    cancel_reason: Optional[str] = None
    zoho_invoice_id: Optional[str] = None
    zoho_invoice_number: Optional[str] = None
    created_at: Optional[str] = None
    items: list[OrderItemOut] = []


class OrderStatusUpdateIn(BaseModel):
    status: Literal["accepted", "delivered", "cancelled"]
    cancel_reason: Optional[str] = Field(default=None, max_length=500)


class ReturnOrderOut(OrderDetailOut):
    """Order detail enriched with the underlying account's contact info, for the admin Return Orders page."""

    customer_first_name: Optional[str] = None
    customer_last_name: Optional[str] = None
    customer_account_email: Optional[str] = None
    customer_account_phone_country_code: Optional[str] = None
    customer_account_phone: Optional[str] = None


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
    country_code: str = Field(min_length=2, max_length=2)
    country_name: str = Field(min_length=1, max_length=80)

    @field_validator("country_code")
    @classmethod
    def uppercase_country_code(cls, v: str) -> str:
        return v.upper()


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
    country_code: Optional[str] = None
    country_name: Optional[str] = None
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


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ForgotPasswordOut(BaseModel):
    message: str


class ResetPasswordIn(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    new_password: str = Field(min_length=8, max_length=128)


# ---------------------------------------------------------------------------
# Customer wishlist
# ---------------------------------------------------------------------------
class WishlistItemIn(BaseModel):
    product_id: str = Field(min_length=1, max_length=160)
    product_name: str = Field(min_length=1, max_length=200)
    product_slug: Optional[str] = Field(default=None, max_length=160)
    image_url: Optional[str] = Field(default=None, max_length=1000)
    price: Optional[float] = Field(default=None, ge=0)
    currency: str = Field(default="BHD", min_length=3, max_length=3)


class WishlistItemOut(WishlistItemIn):
    id: str
    customer_id: str
    created_at: str


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
    address_line1: Optional[str] = Field(default=None, max_length=200)
    address_line2: Optional[str] = Field(default=None, max_length=200)
    city: Optional[str] = Field(default=None, max_length=100)
    state_region: Optional[str] = Field(default=None, max_length=100)
    postal_code: Optional[str] = Field(default=None, max_length=20)
    block_number: Optional[str] = Field(default=None, max_length=20)
    road_number: Optional[str] = Field(default=None, max_length=40)
    building_name: Optional[str] = Field(default=None, max_length=100)
    apartment_number: Optional[str] = Field(default=None, max_length=40)
    district: Optional[str] = Field(default=None, max_length=100)
    tax_id: Optional[str] = Field(default=None, max_length=40)
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


# ---------------------------------------------------------------------------
# Admin panel
# ---------------------------------------------------------------------------
class AdminLoginIn(BaseModel):
    password: str = Field(min_length=1, max_length=200)


class AdminTokenOut(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"


class DeliveryRateOut(BaseModel):
    delivery_type: Literal["bahrain", "gcc", "international"]
    rate_bhd: float
    description: Optional[str] = None


class DeliveryRateIn(BaseModel):
    rate_bhd: float = Field(ge=0)
    description: Optional[str] = Field(default=None, max_length=500)


class PublicSettingsOut(BaseModel):
    iban_number: Optional[str] = None
    whatsapp_number: Optional[str] = None
    return_window_days: int = 7
    delivery_rates: list[DeliveryRateOut] = []


class AdminSettingsIn(BaseModel):
    iban_number: Optional[str] = Field(default=None, max_length=80)
    whatsapp_number: Optional[str] = Field(default=None, max_length=20)
    return_window_days: int = Field(default=7, ge=1, le=90)


class AdminSettingsOut(AdminSettingsIn):
    updated_at: Optional[str] = None


class DashboardStatsOut(BaseModel):
    total_customers: int
    total_orders: int
    total_returns: int
    profit_estimate: float


class AdminCustomerOut(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    phone_country_code: str
    phone: str
    country_name: Optional[str] = None
    is_active: bool = True
    is_banned: bool = False
    created_at: str


class AdminCustomerDetailOut(AdminCustomerOut):
    addresses: list[AddressOut] = []
    orders: list[OrderDetailOut] = []


class CampaignIn(BaseModel):
    subject: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=20000)


class CampaignOut(BaseModel):
    id: str
    subject: str
    body: str
    recipient_count: int
    created_at: str
