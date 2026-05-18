from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from core.config import settings
from routers.plan import router as plan_router
from routers.scraper import router as scraper_router
from routers.destinations import router as destinations_router
from scrapers.scheduler import start_scheduler


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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.NEXT_JS_ORIGIN],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(plan_router, prefix="/api")
app.include_router(scraper_router, prefix="/api")
app.include_router(destinations_router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}