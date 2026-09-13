from fastapi import APIRouter, HTTPException

from ..database import get_supabase
from ..schemas import ContactIn, ContactOut

router = APIRouter(prefix="/contact", tags=["contact"])


@router.post("", response_model=ContactOut, status_code=201)
def submit_contact_message(payload: ContactIn):
    supabase = get_supabase()
    result = (
        supabase.table("contact_messages")
        .insert(
            {
                "name": payload.name,
                "email": payload.email,
                "phone": payload.phone,
                "subject": payload.subject,
                "message": payload.message,
            }
        )
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=500, detail="Could not save your message")
    return {"id": result.data[0]["id"]}
