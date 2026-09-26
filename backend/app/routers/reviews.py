from fastapi import APIRouter, Depends, HTTPException, Query

from ..database import get_supabase
from ..deps import get_current_customer
from ..schemas import ProductReviewIn, ProductReviewListOut, ProductReviewOut

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.get("/product/{product_id}", response_model=ProductReviewListOut)
def list_product_reviews(
    product_id: str,
    limit: int = Query(default=3, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
):
    supabase = get_supabase()
    result = (
        supabase.table("product_reviews")
        .select("id,product_id,reviewer_name,rating,comment,created_at", count="exact")
        .eq("product_id", product_id)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    summary_result = (
        supabase.table("product_review_summaries")
        .select("total,average_rating")
        .eq("product_id", product_id)
        .limit(1)
        .execute()
    )
    summary = summary_result.data[0] if summary_result.data else {"total": 0, "average_rating": 0}
    return {
        "items": result.data or [],
        "total": int(summary.get("total") or 0),
        "average_rating": float(summary.get("average_rating") or 0),
    }


@router.get("/mine/order-items", response_model=list[str])
def list_reviewed_order_items(customer: dict = Depends(get_current_customer)):
    supabase = get_supabase()
    result = (
        supabase.table("product_reviews")
        .select("order_item_id")
        .eq("customer_id", customer["id"])
        .execute()
    )
    return [row["order_item_id"] for row in (result.data or [])]


@router.post("", response_model=ProductReviewOut, status_code=201)
def create_product_review(payload: ProductReviewIn, customer: dict = Depends(get_current_customer)):
    supabase = get_supabase()
    item_result = (
        supabase.table("order_items")
        .select("id,order_id,product_id")
        .eq("id", payload.order_item_id)
        .limit(1)
        .execute()
    )
    if not item_result.data:
        raise HTTPException(status_code=404, detail="Purchased item not found")

    order_item = item_result.data[0]
    if not order_item.get("product_id"):
        raise HTTPException(status_code=400, detail="This order item is not linked to a product")

    order_result = (
        supabase.table("orders")
        .select("id,status,customer_id")
        .eq("id", order_item["order_id"])
        .eq("customer_id", customer["id"])
        .limit(1)
        .execute()
    )
    if not order_result.data:
        raise HTTPException(status_code=403, detail="You can only review items from your own orders")
    if order_result.data[0].get("status") != "delivered":
        raise HTTPException(status_code=400, detail="You can review items after their order is delivered")

    existing = (
        supabase.table("product_reviews")
        .select("id")
        .eq("order_item_id", order_item["id"])
        .limit(1)
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=409, detail="You have already reviewed this item")

    comment = payload.comment.strip() if payload.comment else ""
    result = (
        supabase.table("product_reviews")
        .insert(
            {
                "product_id": order_item["product_id"],
                "order_id": order_item["order_id"],
                "order_item_id": order_item["id"],
                "customer_id": customer["id"],
                "reviewer_name": customer.get("first_name") or "Verified customer",
                "rating": payload.rating,
                "comment": comment or None,
            }
        )
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=500, detail="Could not save your review")
    return result.data[0]
