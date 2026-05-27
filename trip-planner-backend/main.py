import sys
import asyncio
import logging

def setup_logging():
    fmt = (
      "%(asctime)s | %(levelname)-8s | "
      "%(name)-30s | %(message)s"
    )
    logging.basicConfig(
      level=logging.INFO,
      format=fmt,
      datefmt="%H:%M:%S",
      handlers=[logging.StreamHandler(sys.stdout)]
    )
    # Silence noisy libraries
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("playwright").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)

setup_logging()  # call before app = FastAPI()

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from core.config import settings
from routers.plan import router as plan_router
from routers.scraper import router as scraper_router
from routers.destinations import router as destinations_router
from routers.transport import router as transport_router
from scrapers.scheduler import pipeline

logger = logging.getLogger(__name__)

from core.rate_limit import limiter


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager — startup and graceful shutdown."""

    # Rebuild RAG indexes if stale (non-fatal)
    try:
        from rag.faiss_index import (
            places_index,
            hotels_index,
            blogs_index,
            rebuild_indexes_from_db,
        )
        if any([
            places_index.rebuild_needed(),
            hotels_index.rebuild_needed(),
            blogs_index.rebuild_needed(),
        ]):
            rebuild_indexes_from_db()
            logger.info("RAG indexes rebuilt")
    except Exception as e:
        logger.warning(f"RAG rebuild failed (non-fatal): {e}")

    # Start the always-on background scraper pipeline
    await pipeline.start()
    app.state.pipeline = pipeline
    logger.info("Background scraper pipeline started")

    # Reset leftover 'scraping' status in city_pairs_index to 'failed' on startup
    try:
        from core.supabase_client import db
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: db.table("city_pairs_index")
                .update({"scrape_status": "failed"})
                .eq("scrape_status", "scraping")
                .execute()
        )
        logger.info("Lifespan: Stale scraping states in city_pairs_index reset to failed")
    except Exception as e:
        logger.warning(f"Lifespan: Failed to reset stale scraping states (non-fatal): {e}")

    yield

    # Graceful shutdown — cancel background tasks
    await pipeline.stop()
    logger.info("Background scraper pipeline stopped")


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

# Serve dashboard static files at /dashboard/
try:
    app.mount("/dashboard", StaticFiles(directory="dashboard", html=True), name="dashboard")
except Exception:
    logger.warning("Dashboard directory not found — /dashboard/ not mounted")


@app.get("/health")
async def health():
    return {"status": "ok"}