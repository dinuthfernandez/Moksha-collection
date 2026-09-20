"""One-off diagnostic script: places a real test order for one product, walks it through
accepted -> delivered -> return requested -> return completed, and checks the Zoho
Inventory stock level for that item at each step. Safe to delete after use."""

import random
import string
import sys
import time

sys.path.insert(0, ".")

from app.config import get_settings  # noqa: E402
from app.database import get_supabase  # noqa: E402
from app.security import hash_password  # noqa: E402
from app.services.zoho_inventory import ZohoInventoryClient  # noqa: E402

PRODUCT_ID = "873262b3-25f3-4fba-ab4c-d3ab61992f30"  # SET MUNDU
ZOHO_ITEM_ID = "6877211000003538191"

settings = get_settings()
supabase = get_supabase()
zoho = ZohoInventoryClient(
    client_id=settings.zoho_client_id,
    client_secret=settings.zoho_client_secret,
    refresh_token=settings.zoho_refresh_token,
    organization_id=settings.zoho_organization_id,
)


def zoho_stock() -> int:
    items = zoho.fetch_all_items()
    for item in items:
        if str(item.get("item_id")) == ZOHO_ITEM_ID:
            for key in ("stock_on_hand", "available_stock", "actual_available_stock"):
                if item.get(key) not in (None, ""):
                    return int(item[key])
    return -1


def local_stock() -> int:
    r = supabase.table("products").select("stock_quantity").eq("id", PRODUCT_ID).limit(1).execute()
    return r.data[0]["stock_quantity"]


print("=== BEFORE ORDER ===")
print("Zoho stock:", zoho_stock())
print("Local stock:", local_stock())

# 1. Create a throwaway test customer directly (skip HTTP registration/email noise).
suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=6))
email = f"stocktest-{suffix}@example.com"

customer_result = (
    supabase.table("customers")
    .insert(
        {
            "email": email,
            "password_hash": hash_password("Test1234!"),
            "first_name": "Stock",
            "last_name": "Test",
            "phone_country_code": "+973",
            "phone": "3" + "".join(random.choices(string.digits, k=7)),
            "country_code": "BH",
            "country_name": "Bahrain",
        }
    )
    .execute()
)
customer = customer_result.data[0]
print("\nCreated test customer:", customer["id"], email)

# 2. Directly insert the order the same way the real /orders endpoint does.
subtotal = 6.4
delivery_charge = 1.0
order_result = (
    supabase.table("orders")
    .insert(
        {
            "customer_id": customer["id"],
            "customer_name": "Stock Test",
            "phone": "+9733" + "".join(random.choices(string.digits, k=6)),
            "email": email,
            "address": "Test address",
            "city": "Manama",
            "delivery_type": "bahrain",
            "delivery_charge": delivery_charge,
            "subtotal_amount": subtotal,
            "total_amount": subtotal + delivery_charge,
            "status": "pending",
        }
    )
    .execute()
)
order = order_result.data[0]
order_id = order["id"]
print("Created test order:", order_id)

supabase.table("order_items").insert(
    {
        "order_id": order_id,
        "product_id": PRODUCT_ID,
        "product_name": "SET MUNDU",
        "quantity": 1,
        "price": subtotal,
    }
).execute()

new_stock = max(local_stock() - 1, 0)
supabase.table("products").update({"stock_quantity": new_stock}).eq("id", PRODUCT_ID).execute()

print("\n=== AFTER ORDER PLACED (local stock manually decremented, like the real endpoint) ===")
print("Zoho stock:", zoho_stock())
print("Local stock:", local_stock())

# 3. Mark accepted -> delivered (mirrors admin PUT /admin/orders/{id}/status)
supabase.table("orders").update({"status": "accepted", "updated_at": "now()"}).eq("id", order_id).execute()
supabase.table("orders").update({"status": "delivered", "updated_at": "now()"}).eq("id", order_id).execute()
print("\nOrder marked delivered.")

# 4. Customer requests a return (mirrors POST /orders/{id}/return)
supabase.table("orders").update(
    {"return_status": "requested", "return_requested_at": "now()"}
).eq("id", order_id).execute()
print("Return requested.")

# 5. Admin completes the return — this is the real restock function, imported directly.
from app.routers.admin import _restock_order_items  # noqa: E402

_restock_order_items(supabase, order_id)
supabase.table("orders").update(
    {"return_status": "completed", "return_completed_at": "now()"}
).eq("id", order_id).execute()
print("Return marked completed and restock function executed.")

time.sleep(2)
print("\n=== AFTER RETURN COMPLETED ===")
print("Zoho stock:", zoho_stock())
print("Local stock:", local_stock())

# Cleanup: remove the test order/customer so they don't pollute real admin data.
supabase.table("order_items").delete().eq("order_id", order_id).execute()
supabase.table("orders").delete().eq("id", order_id).execute()
supabase.table("customers").delete().eq("id", customer["id"]).execute()
print("\nCleaned up test order/customer.")
