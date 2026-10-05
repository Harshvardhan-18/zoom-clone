"""Auth endpoints: register, login. Uses SHA-256 password hashing (no extra deps)."""

import hashlib
import secrets
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])

# In-memory token store: token -> user_id
# Resets on server restart — acceptable for a demo app with ephemeral SQLite.
_tokens: dict[str, int] = {}


def _hash(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


def create_token(user_id: int) -> str:
    token = secrets.token_hex(32)
    _tokens[token] = user_id
    return token


def get_user_from_token(token: str, db: Session) -> models.User | None:
    user_id = _tokens.get(token)
    if user_id is None:
        return None
    return db.query(models.User).filter_by(id=user_id).first()


# ── Register ──────────────────────────────────────────────────────────────────

@router.post("/register", response_model=schemas.AuthResponse, status_code=201)
def register(body: schemas.RegisterRequest, db: Session = Depends(get_db)):
    """Create a new user account."""
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Name is required")
    if not body.email.strip():
        raise HTTPException(status_code=400, detail="Email is required")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    existing = db.query(models.User).filter_by(email=body.email.strip().lower()).first()
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists")

    user = models.User(
        name=body.name.strip(),
        email=body.email.strip().lower(),
        password_hash=_hash(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_token(user.id)
    return {"token": token, "user": user}


# ── Login ─────────────────────────────────────────────────────────────────────

@router.post("/login", response_model=schemas.AuthResponse)
def login(body: schemas.LoginRequest, db: Session = Depends(get_db)):
    """Log in with email + password. Also accepts the default demo account."""
    email = body.email.strip().lower()
    user = db.query(models.User).filter_by(email=email).first()
    if not user and email == "alex@example.com":
        # Fallback to default user if email was edited in profile
        user = db.query(models.User).filter_by(id=1).first()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Allow login even if password_hash is NULL (legacy / demo default user)
    if user.password_hash is None:
        # Set the password on first login attempt for default user
        user.password_hash = _hash(body.password)
        db.commit()
    elif user.password_hash != _hash(body.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_token(user.id)
    return {"token": token, "user": user}


# ── Validate token ────────────────────────────────────────────────────────────

@router.get("/me", response_model=schemas.UserOut)
def auth_me(token: str, db: Session = Depends(get_db)):
    """Validate a token and return the user."""
    user = get_user_from_token(token, db)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session")
    return user
