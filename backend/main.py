import asyncio
import logging

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.endpoints import router
from app.api.bot_endpoints import router as bot_router
from app.api.webhooks import router as webhooks_router

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Background message processor
# ---------------------------------------------------------------------------

async def _background_processor():
    """Poll for unprocessed messages every 10 seconds and extract context."""
    from app.services.supabase import get_supabase
    from app.services.context_engine import process_message

    await asyncio.sleep(5)  # Wait for startup
    logger.info("Background message processor started")

    while True:
        try:
            sb = get_supabase()
            resp = (
                sb.table("messages")
                .select("id")
                .eq("processed", False)
                .order("created_at", desc=False)
                .limit(10)
                .execute()
            )
            messages = resp.data or []

            for msg in messages:
                try:
                    await process_message(msg["id"])
                except Exception as e:
                    logger.error(f"Process error for {msg['id']}: {e}")

            if messages:
                logger.info(f"Processed {len(messages)} messages")
        except Exception as e:
            logger.error(f"Background processor error: {e}")

        await asyncio.sleep(10)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start background tasks on app startup."""
    task = asyncio.create_task(_background_processor())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="ContextBridge",
    description="AI Workspaces with Efficient Memory — Context Tree",
    version="0.2.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS — allow local Next.js dev server and any deployed frontend
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
app.include_router(router, prefix="/api")
app.include_router(bot_router, prefix="/api")
app.include_router(webhooks_router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}