import logging

from fastapi import APIRouter, Depends, HTTPException, Response
from postgrest.exceptions import APIError
from pydantic import BaseModel, ConfigDict, StrictBool, ValidationError

from ..database import get_supabase
from ..deps import get_current_admin

logger = logging.getLogger(__name__)
KEY = "home_test_visibility"
router = APIRouter(tags=["home test visibility"])


class HomeTestVisibility(BaseModel):
    model_config = ConfigDict(extra="forbid")

    under_5: StrictBool
    clearance: StrictBool
    discounts: StrictBool


def _read_visibility() -> HomeTestVisibility:
    try:
        rows = get_supabase().table("app_state").select("value").eq("key", KEY).limit(1).execute().data
        if not rows:
            return HomeTestVisibility(under_5=True, clearance=True, discounts=True)
        return HomeTestVisibility.model_validate(rows[0]["value"])
    except (APIError, ValidationError, KeyError) as exc:
        logger.exception("Could not load test homepage visibility")
        raise HTTPException(status_code=503, detail="Could not load homepage visibility settings") from exc


@router.get("/home-test-visibility", response_model=HomeTestVisibility)
def get_visibility(response: Response) -> HomeTestVisibility:
    response.headers["Cache-Control"] = "no-store"
    return _read_visibility()


@router.put("/admin/home-test-visibility", response_model=HomeTestVisibility, dependencies=[Depends(get_current_admin)])
def update_visibility(payload: HomeTestVisibility, response: Response) -> HomeTestVisibility:
    try:
        get_supabase().table("app_state").upsert({"key": KEY, "value": payload.model_dump()}).execute()
    except APIError as exc:
        logger.exception("Could not save test homepage visibility")
        raise HTTPException(status_code=503, detail="Could not save homepage visibility settings") from exc
    response.headers["Cache-Control"] = "no-store"
    return payload
