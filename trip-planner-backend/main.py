import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from contextlib import asynccontextmanager
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from core.config import settings
from routers.plan import router as plan_router
from routers.scraper import router as scraper_router
from routers.destinations import router as destinations_router
from routers.transport import router as transport_router
from scrapers.scheduler import start_scheduler

logger = logging.getLogger(__name__)

from core.rate_limit import limiter


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown."""
    # Startup: rebuild RAG indexes if needed
    from rag.faiss_index import places_index, hotels_index, blogs_index, rebuild_indexes_from_db

    if places_index.rebuild_needed() or hotels_index.rebuild_needed() or blogs_index.rebuild_needed():
        try:
            rebuild_indexes_from_db()
        except Exception as e:
            print(f"RAG index rebuild failed: {e}")

    # Start the scheduler
    scheduler = start_scheduler()
    app.state.scheduler = scheduler

    yield

    # Shutdown: stop the scheduler
    scheduler.shutdown()


app = FastAPI(title="Trip Planner Backend", lifespan=lifespan)

# Register rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.NEXT_JS_ORIGIN],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Global exception handlers — prevent stack traces from leaking to clients
# ---------------------------------------------------------------------------

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all: log full error server-side, return safe response to client."""
    logger.error(f"Unhandled error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error", "detail": None},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Return 422 with field-level detail but no Python traceback."""
    return JSONResponse(
        status_code=422,
        content={"error": "Invalid request", "detail": exc.errors()},
    )


app.include_router(plan_router, prefix="/api")
app.include_router(scraper_router, prefix="/api")
app.include_router(destinations_router, prefix="/api")
app.include_router(transport_router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}