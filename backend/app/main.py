"""
SIH 26079: FastAPI Main Application
AI-Based Forecast Bust Detection for Medium-Range Weather Forecasts
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api.endpoints import router as api_router
from .core.config import PROJECT_NAME, VERSION

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Start automated NOAA GEFS background poller
    try:
        from .services.gefs_poller_service import gefs_poller_service
        gefs_poller_service.start()
    except Exception as e:
        print(f"[Main] Failed to start GEFS background poller: {e}")
    yield
    # Shutdown: Cleanly stop poller thread
    try:
        from .services.gefs_poller_service import gefs_poller_service
        gefs_poller_service.stop()
    except Exception as e:
        print(f"[Main] Failed to stop GEFS background poller: {e}")

app = FastAPI(
    title=PROJECT_NAME,
    description="Operational API for detecting and explaining medium-range weather forecast busts (Day 1-10)",
    version=VERSION,
    lifespan=lifespan
)

# Configure CORS for local React/Vite development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount endpoints under /api and root health
app.include_router(api_router, prefix="/api")

@app.get("/health")
def root_health():
    from .services.ml_service import ml_service
    return {
        "status": "healthy",
        "service": PROJECT_NAME,
        "version": VERSION,
        "model_loaded": ml_service.model is not None,
        "mode": "DEMO / SYNTHETIC NWP DATA LAYER"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
