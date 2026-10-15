import asyncio
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, PlainTextResponse, Response
from pydantic import BaseModel, Field

from . import security
from .config import get_settings
from .routers import (
    addresses,
    admin,
    admin_auth,
    analytics,
    announcements,
    auth,
    cart,
    categories,
    contact,
    coupons,
    health,
    orders,
    products,
    reviews,
    rider,
    settings as settings_router,
    size_charts,
    superadmin,
    webhooks,
    wishlists,
)
from .services import seo, superadmin_state
from .services.cart_reservations import cart_reservation_expiry_loop
from .services.zoho_inventory import sync_loop

settings = get_settings()
superadmin_state.install_log_buffer()

app = FastAPI(
    title="Moksha Collections API",
    description="Backend API for the Moksha Collections storefront.",
    version="1.0.0",
)

app.add_middleware(GZipMiddleware, minimum_size=1024)

MAINTENANCE_ALLOWED_PREFIXES = ("/api/superadmin", "/api/maintenance", "/api/health", "/api/webhooks")


BYPASS_COOKIE = "mc_maint_bypass"


def _has_bypass(request: Request) -> bool:
    return superadmin_state.has_bypass_password() and security.is_valid_bypass_token(
        request.cookies.get(BYPASS_COOKIE), superadmin_state.bypass_fingerprint()
    )


@app.middleware("http")
async def maintenance_gate(request: Request, call_next):
    path = request.url.path
    if (
        superadmin_state.is_maintenance_on()
        and path.startswith("/api")
        and request.method != "OPTIONS"
        and not path.startswith(MAINTENANCE_ALLOWED_PREFIXES)
        and not _has_bypass(request)
    ):
        return JSONResponse(
            status_code=503,
            content={"detail": "maintenance", "maintenance": True},
            headers={**_cors_headers(request), "Retry-After": "300"},
        )
    return await call_next(request)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _cors_headers(request: Request) -> dict[str, str]:
    # Starlette's CORS middleware does not attach headers to responses coming
    # from exception handlers, so error responses must add them explicitly —
    # otherwise browsers report a misleading "CORS policy" error on any 4xx/5xx.
    origin = request.headers.get("origin")
    if origin and origin in settings.cors_origins:
        return {"Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true", "Vary": "Origin"}
    return {}


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail}, headers=_cors_headers(request))


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    # A malformed request body (e.g. invalid JSON) puts raw bytes into exc.errors(),
    # which the default JSON encoder can't serialize — decode those before responding.
    safe_errors = jsonable_encoder(exc.errors(), custom_encoder={bytes: lambda value: value.decode("utf-8", "replace")})
    return JSONResponse(status_code=422, content={"detail": safe_errors}, headers=_cors_headers(request))


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Avoids leaking internal error details (stack traces, DB messages) to the client.
    return JSONResponse(
        status_code=500,
        content={"detail": "Something went wrong. Please try again shortly."},
        headers=_cors_headers(request),
    )


app.include_router(health.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(webhooks.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(products.router, prefix="/api")
app.include_router(reviews.router, prefix="/api")
app.include_router(size_charts.router, prefix="/api")
app.include_router(announcements.router, prefix="/api")
app.include_router(contact.router, prefix="/api")
app.include_router(coupons.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(cart.router, prefix="/api")
app.include_router(addresses.router, prefix="/api")
app.include_router(wishlists.router, prefix="/api")
app.include_router(orders.router, prefix="/api")
app.include_router(rider.router, prefix="/api")
app.include_router(settings_router.router, prefix="/api")
app.include_router(admin_auth.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(superadmin.router, prefix="/api")


@app.get("/api/maintenance")
def maintenance_status(request: Request):
    state = superadmin_state.get_maintenance()
    return {
        "enabled": state["enabled"],
        "message": state["message"],
        "eta": state["eta"],
        "bypass": state["enabled"] and _has_bypass(request),
        "bypass_available": superadmin_state.has_bypass_password(),
    }


class BypassIn(BaseModel):
    password: str = Field(min_length=1, max_length=200)


@app.post("/api/maintenance/bypass")
async def maintenance_bypass(payload: BypassIn, request: Request):
    ip = "bypass:" + (request.client.host if request.client else "unknown")
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        ip = "bypass:" + forwarded.split(",")[0].strip()
    remaining = superadmin_state.lock_remaining(ip)
    if remaining:
        raise HTTPException(status_code=429, detail=f"Too many attempts. Try again in {remaining // 60 + 1} minute(s).")
    if not superadmin_state.verify_bypass_password(payload.password):
        superadmin_state.register_failure(ip)
        superadmin_state.audit("bypass_failed", ip)
        await asyncio.sleep(1.5)
        raise HTTPException(status_code=401, detail="Access denied")
    superadmin_state.register_success(ip)
    superadmin_state.audit("bypass_ok", ip)
    response = JSONResponse({"ok": True})
    response.set_cookie(
        BYPASS_COOKIE,
        security.create_bypass_token(superadmin_state.bypass_fingerprint()),
        max_age=security.BYPASS_COOKIE_HOURS * 3600,
        httponly=True,
        samesite="lax",
        secure=request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https",
        path="/",
    )
    return response


@app.post("/api/maintenance/bypass/logout")
def maintenance_bypass_logout():
    response = JSONResponse({"ok": True})
    response.delete_cookie(BYPASS_COOKIE, path="/")
    return response


@app.on_event("startup")
async def startup_event():
    settings = get_settings()
    if all(
        [
            settings.zoho_client_id,
            settings.zoho_client_secret,
            settings.zoho_refresh_token,
            settings.zoho_organization_id,
        ]
    ):
        asyncio.create_task(sync_loop())
        asyncio.create_task(cart_reservation_expiry_loop())


# ---------------------------------------------------------------------------
# Serve the built frontend (frontend/dist) from this same service, so the
# whole site is one Render web service instead of a separate static site.
# Only activates when a build actually exists — local dev (no dist/ folder)
# keeps using the separate Vite dev server on :5173 untouched.
# ---------------------------------------------------------------------------
FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"

if FRONTEND_DIST.is_dir():

    @app.get("/sitemap.xml")
    def sitemap():
        return Response(seo.sitemap_xml(), media_type="application/xml", headers={"Cache-Control": "public, max-age=3600"})

    @app.get("/robots.txt")
    def robots():
        return PlainTextResponse(seo.robots_txt(), headers={"Cache-Control": "public, max-age=3600"})

    @app.get("/llms.txt")
    def llms():
        return PlainTextResponse(seo.llms_txt(), headers={"Cache-Control": "public, max-age=3600"})

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        if full_path == "api" or full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        if full_path:
            candidate = (FRONTEND_DIST / full_path).resolve()
            if candidate.is_file() and FRONTEND_DIST.resolve() in candidate.parents:
                headers = {"Cache-Control": "public, max-age=31536000, immutable"} if full_path.startswith("assets/") else {}
                return FileResponse(candidate, headers=headers)

        index_file = FRONTEND_DIST / "index.html"
        if not index_file.is_file():
            raise HTTPException(status_code=404, detail="Frontend build not found")
        try:
            page = seo.resolve("/" + full_path)
            html = seo.inject(index_file.read_text(encoding="utf-8"), page)
            status = page["status"]
            headers = {"Cache-Control": "public, max-age=300"}
            if page["noindex"]:
                headers["X-Robots-Tag"] = "noindex, nofollow"
            return HTMLResponse(html, status_code=status, headers=headers)
        except Exception:
            return FileResponse(index_file)

else:

    @app.get("/")
    def root():
        return {"service": "moksha-collections-api", "status": "running"}

