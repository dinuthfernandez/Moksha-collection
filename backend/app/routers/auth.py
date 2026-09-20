from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException

from ..config import get_settings
from ..database import execute_with_retry, get_supabase
from ..deps import get_current_customer
from ..schemas import (
    CustomerOut,
    CustomerUpdateIn,
    ForgotPasswordIn,
    ForgotPasswordOut,
    LoginIn,
    RegisterIn,
    ResetPasswordIn,
    TokenOut,
)
from ..security import create_access_token, generate_reset_code, hash_password, verify_password
from ..services.email import send_info_email
from ..services.email_templates import (
    render_password_reset_code_email,
    render_password_reset_done_email,
    render_welcome_email,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenOut, status_code=201)
def register(payload: RegisterIn):
    supabase = get_supabase()

    existing_email = execute_with_retry(
        lambda: supabase.table("customers").select("id").eq("email", payload.email.lower()).limit(1).execute()
    )
    if existing_email.data:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    existing_phone = execute_with_retry(
        lambda: supabase.table("customers")
        .select("id")
        .eq("phone_country_code", payload.phone_country_code)
        .eq("phone", payload.phone)
        .limit(1)
        .execute()
    )
    if existing_phone.data:
        raise HTTPException(status_code=409, detail="An account with this phone number already exists")

    result = execute_with_retry(
        lambda: supabase.table("customers")
        .insert(
            {
                "email": payload.email.lower(),
                "password_hash": hash_password(payload.password),
                "first_name": payload.first_name,
                "last_name": payload.last_name,
                "phone_country_code": payload.phone_country_code,
                "phone": payload.phone,
                "country_code": payload.country_code,
                "country_name": payload.country_name,
            }
        )
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=500, detail="Could not create your account")

    customer = result.data[0]
    token = create_access_token(customer["id"])

    try:
        subject, html, text = render_welcome_email(customer["first_name"])
        send_info_email(customer["email"], subject, html, text)
    except Exception:
        # Registration still succeeds even if the welcome email fails to send.
        pass

    return {"access_token": token, "customer": customer}


@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn):
    supabase = get_supabase()
    result = execute_with_retry(
        lambda: supabase.table("customers").select("*").eq("email", payload.email.lower()).limit(1).execute()
    )

    # Same generic error whether the email is unknown or the password is wrong,
    # so we never reveal which accounts exist.
    invalid_credentials = HTTPException(status_code=401, detail="Incorrect email or password")

    if not result.data:
        raise invalid_credentials

    customer = result.data[0]
    if not verify_password(payload.password, customer["password_hash"]):
        raise invalid_credentials

    if not customer.get("is_active", True):
        raise HTTPException(status_code=403, detail="This account has been disabled")

    token = create_access_token(customer["id"])
    return {"access_token": token, "customer": customer}


@router.get("/me", response_model=CustomerOut)
def me(customer: dict = Depends(get_current_customer)):
    return customer


@router.put("/me", response_model=CustomerOut)
def update_me(payload: CustomerUpdateIn, customer: dict = Depends(get_current_customer)):
    supabase = get_supabase()
    result = (
        supabase.table("customers")
        .update(
            {
                "first_name": payload.first_name,
                "last_name": payload.last_name,
                "phone_country_code": payload.phone_country_code,
                "phone": payload.phone,
            }
        )
        .eq("id", customer["id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=500, detail="Could not update your profile")
    return result.data[0]


@router.post("/forgot-password", response_model=ForgotPasswordOut)
def forgot_password(payload: ForgotPasswordIn):
    supabase = get_supabase()
    result = supabase.table("customers").select("id,first_name,email").eq("email", payload.email.lower()).limit(1).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="No account was found with this email address")

    customer = result.data[0]
    settings = get_settings()
    code = generate_reset_code()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.password_reset_code_expires_minutes)

    # Invalidate any codes requested earlier so only the latest one works.
    supabase.table("password_reset_codes").delete().eq("customer_id", customer["id"]).is_("used_at", "null").execute()
    supabase.table("password_reset_codes").insert(
        {"customer_id": customer["id"], "code_hash": hash_password(code), "expires_at": expires_at.isoformat()}
    ).execute()

    try:
        subject, html, text = render_password_reset_code_email(
            customer["first_name"], code, settings.password_reset_code_expires_minutes
        )
        send_info_email(customer["email"], subject, html, text)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not send the reset code email: {exc}") from exc

    return {"message": "A 6-digit reset code has been sent to your email"}


@router.post("/reset-password", response_model=ForgotPasswordOut)
def reset_password(payload: ResetPasswordIn):
    supabase = get_supabase()
    customer_result = (
        supabase.table("customers").select("id,first_name,email").eq("email", payload.email.lower()).limit(1).execute()
    )
    invalid = HTTPException(status_code=400, detail="Invalid or expired reset code")
    if not customer_result.data:
        raise invalid
    customer = customer_result.data[0]

    codes_result = (
        supabase.table("password_reset_codes")
        .select("*")
        .eq("customer_id", customer["id"])
        .is_("used_at", "null")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not codes_result.data:
        raise invalid

    reset_code = codes_result.data[0]
    expires_at = datetime.fromisoformat(reset_code["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="This reset code has expired — request a new one")
    if not verify_password(payload.code, reset_code["code_hash"]):
        raise invalid

    supabase.table("customers").update({"password_hash": hash_password(payload.new_password)}).eq(
        "id", customer["id"]
    ).execute()
    supabase.table("password_reset_codes").update({"used_at": datetime.now(timezone.utc).isoformat()}).eq(
        "id", reset_code["id"]
    ).execute()

    try:
        subject, html, text = render_password_reset_done_email(customer["first_name"])
        send_info_email(customer["email"], subject, html, text)
    except Exception:
        # The password is already changed — a failed confirmation email shouldn't block the user.
        pass

    return {"message": "Your password has been reset successfully"}
