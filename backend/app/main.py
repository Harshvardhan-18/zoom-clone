"""FastAPI application entry point: CORS, routers, and startup DB init."""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.database import engine, SessionLocal, Base, get_db
from app.seed import seed_if_empty, DEFAULT_USER_ID
from app.routers import meetings, participants, signal
from app import models, schemas


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Create tables and seed the database on startup."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_if_empty(db)
    finally:
        db.close()
    yield


app = FastAPI(title="Zoom Clone API", lifespan=lifespan)

# ── CORS ──────────────────────────────────────────────────────────────────────
raw_origins = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")
allowed_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]
if "http://localhost:3000" not in allowed_origins:
    allowed_origins.append("http://localhost:3000")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/", tags=["health"])
@app.get("/health", tags=["health"])
def health_check():
    """Health check endpoint for Render/uptime monitors."""
    return {"status": "ok", "app": "Zoom Clone API"}

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(meetings.router)
app.include_router(participants.router)
app.include_router(signal.router)


# ── Default user endpoint ─────────────────────────────────────────────────────
@app.get("/api/me", response_model=schemas.UserOut, tags=["users"])
def get_me(db: Session = Depends(get_db)):
    """Return the always-logged-in default user."""
    user = db.query(models.User).filter_by(id=DEFAULT_USER_ID).first()
    return user


@app.patch("/api/me", response_model=schemas.UserOut, tags=["users"])
def update_me(body: schemas.UserUpdate, db: Session = Depends(get_db)):
    """Update default user's name and/or email."""
    user = db.query(models.User).filter_by(id=DEFAULT_USER_ID).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if body.name is not None and body.name.strip():
        user.name = body.name.strip()
    if body.email is not None and body.email.strip():
        user.email = body.email.strip()
    db.commit()
    db.refresh(user)
    return user
