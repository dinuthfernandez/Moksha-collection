import asyncio

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .routers import (
    addresses,
    admin,
    admin_auth,
    announcements,
    auth,
    categories,
    contact,
    health,
    orders,
    products,
    settings as settings_router,
    size_charts,
    wishlists,
)
from .services.zoho_inventory import sync_loop

settings = get_settings()

app = FastAPI(
    title="Moksha Collections API",
    description="Backend API for the Moksha Collections storefront.",
    version="1.0.0",
)

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
    return JSONResponse(status_code=422, content={"detail": exc.errors()}, headers=_cors_headers(request))


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Avoids leaking internal error details (stack traces, DB messages) to the client.
    return JSONResponse(
        status_code=500,
        content={"detail": "Something went wrong. Please try again shortly."},
        headers=_cors_headers(request),
    )


app.include_router(health.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(products.router, prefix="/api")
app.include_router(size_charts.router, prefix="/api")
app.include_router(announcements.router, prefix="/api")
app.include_router(contact.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(addresses.router, prefix="/api")
app.include_router(wishlists.router, prefix="/api")
app.include_router(orders.router, prefix="/api")
app.include_router(settings_router.router, prefix="/api")
app.include_router(admin_auth.router, prefix="/api")
app.include_router(admin.router, prefix="/api")


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


@app.get("/")
def root():
    return {"service": "moksha-collections-api", "status": "running"}

