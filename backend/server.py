from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone
import httpx


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Emergent managed push relay
PUSH_BASE_URL = "https://integrations.emergentagent.com"
PUSH_KEY = os.environ.get("EMERGENT_PUSH_KEY", "placeholder")
_push_client = httpx.AsyncClient(
    base_url=PUSH_BASE_URL,
    headers={"X-Push-Key": PUSH_KEY},
    timeout=10.0,
)

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class RegisterPushBody(BaseModel):
    user_id: str
    platform: str  # "android" | "ios"
    device_token: str


class EventCreate(BaseModel):
    device_id: str
    clip_id: str
    type: Literal["impact", "trip"] = "trip"
    recorded_at: str  # ISO timestamp from the device
    duration_sec: float = 0
    max_speed_kmh: float = 0
    avg_speed_kmh: float = 0
    g_force: Optional[float] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    has_video: bool = True


class Event(EventCreate):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=now_iso)


# ---------------------------------------------------------------------------
# Push relay helpers
# ---------------------------------------------------------------------------
async def send_push(recipients: List[str], data: dict, idempotency_key: Optional[str] = None) -> None:
    if not recipients:
        return
    if len(recipients) > 100:
        raise ValueError("max 100 recipients per /trigger call; chunk before sending")
    if "title" not in data or "message" not in data:
        raise ValueError("data must include title and message")
    payload: dict = {"recipients": recipients, "data": data}
    if idempotency_key:
        payload["$idempotency_key"] = idempotency_key
    resp = await _push_client.post("/api/v1/push/trigger", json=payload)
    if resp.status_code == 401:
        raise HTTPException(500, "EMERGENT_PUSH_KEY missing or invalid")
    if resp.status_code >= 500:
        raise HTTPException(502, "Push provider unavailable")
    resp.raise_for_status()


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@api_router.get("/")
async def root():
    return {"message": "Dash Cam API", "status": "ok"}


@api_router.post("/register-push", status_code=201)
async def register_push(body: RegisterPushBody):
    resp = await _push_client.post("/api/v1/push/users/register", json=body.model_dump())
    if resp.status_code == 401:
        raise HTTPException(500, "EMERGENT_PUSH_KEY missing or invalid")
    if resp.status_code >= 500:
        raise HTTPException(502, "Push provider unavailable")
    resp.raise_for_status()
    return {"status": "registered"}


@api_router.post("/events", response_model=Event, status_code=201)
async def create_event(body: EventCreate):
    event = Event(**body.model_dump())
    await db.events.insert_one(event.model_dump())

    if event.type == "impact":
        speed = round(event.max_speed_kmh)
        g = f" · {event.g_force:.1f}g" if event.g_force is not None else ""
        try:
            await send_push(
                recipients=[event.device_id],
                data={
                    "title": "Impact detected",
                    "message": f"Clip saved at {speed} km/h{g}. Tap to review.",
                    "action_url": f"/clip/{event.clip_id}",
                },
                idempotency_key=f"impact-{event.clip_id}",
            )
        except Exception as e:  # push must never block saving the event
            logger.warning(f"Push failed (non-blocking): {e}")
    return event


@api_router.get("/events", response_model=List[Event])
async def list_events(device_id: str, limit: int = 200):
    docs = (
        await db.events.find({"device_id": device_id}, {"_id": 0})
        .sort("recorded_at", -1)
        .to_list(min(limit, 500))
    )
    return [Event(**d) for d in docs]


@api_router.delete("/events/{clip_id}")
async def delete_event(clip_id: str, device_id: str):
    result = await db.events.delete_one({"clip_id": clip_id, "device_id": device_id})
    return {"deleted": result.deleted_count}


@api_router.delete("/events")
async def delete_all_events(device_id: str):
    result = await db.events.delete_many({"device_id": device_id})
    return {"deleted": result.deleted_count}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
    await _push_client.aclose()
