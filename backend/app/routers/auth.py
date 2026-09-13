from fastapi import APIRouter, Depends, HTTPException

from ..database import get_supabase
from ..deps import get_current_customer
from ..schemas import CustomerOut, CustomerUpdateIn, LoginIn, RegisterIn, TokenOut
from ..security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenOut, status_code=201)
def register(payload: RegisterIn):
    supabase = get_supabase()

    existing = supabase.table("customers").select("id").eq("email", payload.email.lower()).limit(1).execute()
    if existing.data:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    result = (
        supabase.table("customers")
        .insert(
            {
                "email": payload.email.lower(),
                "password_hash": hash_password(payload.password),
                "first_name": payload.first_name,
                "last_name": payload.last_name,
                "phone_country_code": payload.phone_country_code,
                "phone": payload.phone,
            }
        )
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=500, detail="Could not create your account")

    customer = result.data[0]
    token = create_access_token(customer["id"])
    return {"access_token": token, "customer": customer}


@router.post("/login", response_model=TokenOut)
def login(payload: LoginIn):
    supabase = get_supabase()
    result = supabase.table("customers").select("*").eq("email", payload.email.lower()).limit(1).execute()

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
