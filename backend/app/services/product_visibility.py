from typing import Any


def is_storefront_product(sku: str | None) -> bool:
    sku = (sku or "").upper()
    return sku != "DELIVERY" and not sku.startswith("TEST-")


def filter_storefront_products(query: Any) -> Any:
    return query.eq("category_hierarchy_valid", True).or_(
        "zoho_sku.is.null,and(zoho_sku.not.ilike.DELIVERY,zoho_sku.not.ilike.TEST-*)"
    )
