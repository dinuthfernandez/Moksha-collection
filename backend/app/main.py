from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routers import announcements, categories, contact, health, size_charts

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

app.include_router(health.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(size_charts.router, prefix="/api")
app.include_router(announcements.router, prefix="/api")
app.include_router(contact.router, prefix="/api")


@app.get("/")
def root():
    return {"service": "moksha-collections-api", "status": "running"}
