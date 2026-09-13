from fastapi import APIRouter, Depends, HTTPException

from ..database import get_supabase
from ..deps import get_current_customer
from ..schemas import AddressIn, AddressOut

router = APIRouter(prefix="/addresses", tags=["addresses"])


@router.get("", response_model=list[AddressOut])
def list_addresses(customer: dict = Depends(get_current_customer)):
    supabase = get_supabase()
    result = (
        supabase.table("customer_addresses")
        .select("*")
        .eq("customer_id", customer["id"])
        .order("is_default", desc=True)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


@router.post("", response_model=AddressOut, status_code=201)
def create_address(payload: AddressIn, customer: dict = Depends(get_current_customer)):
    supabase = get_supabase()

    if payload.is_default:
        supabase.table("customer_addresses").update({"is_default": False}).eq("customer_id", customer["id"]).execute()

    result = (
        supabase.table("customer_addresses")
        .insert({**payload.model_dump(), "customer_id": customer["id"]})
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=500, detail="Could not save this address")
    return result.data[0]


def _get_owned_address(supabase, address_id: str, customer_id: str) -> dict:
    result = supabase.table("customer_addresses").select("*").eq("id", address_id).limit(1).execute()
    if not result.data or result.data[0]["customer_id"] != customer_id:
        raise HTTPException(status_code=404, detail="Address not found")
    return result.data[0]


@router.put("/{address_id}", response_model=AddressOut)
def update_address(address_id: str, payload: AddressIn, customer: dict = Depends(get_current_customer)):
    supabase = get_supabase()
    _get_owned_address(supabase, address_id, customer["id"])

    if payload.is_default:
        supabase.table("customer_addresses").update({"is_default": False}).eq("customer_id", customer["id"]).execute()

    result = supabase.table("customer_addresses").update(payload.model_dump()).eq("id", address_id).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Could not update this address")
    return result.data[0]


@router.delete("/{address_id}", status_code=204)
def delete_address(address_id: str, customer: dict = Depends(get_current_customer)):
    supabase = get_supabase()
    _get_owned_address(supabase, address_id, customer["id"])
    supabase.table("customer_addresses").delete().eq("id", address_id).execute()
