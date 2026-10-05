"""Pydantic schemas for request validation and response serialization."""

from datetime import datetime, timezone
from typing import Optional
from pydantic import BaseModel, field_serializer


def _serialize_utc(v: Optional[datetime]) -> Optional[str]:
    if v is None:
        return None
    if v.tzinfo is None:
        v = v.replace(tzinfo=timezone.utc)
    else:
        v = v.astimezone(timezone.utc)
    return v.isoformat()


# ── User ──────────────────────────────────────────────────────────────────────

class UserOut(BaseModel):
    id: int
    name: str
    email: str
    avatar_color: str
    created_at: datetime

    @field_serializer("created_at")
    def serialize_created_at(self, v: datetime, _info) -> Optional[str]:
        return _serialize_utc(v)

    model_config = {"from_attributes": True}


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


class AuthResponse(BaseModel):
    token: str
    user: UserOut


# ── Meeting ───────────────────────────────────────────────────────────────────

class MeetingCreate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    duration_minutes: Optional[int] = 30


class MeetingOut(BaseModel):
    id: int
    meeting_code: str
    title: str
    description: Optional[str]
    host_id: int
    type: str
    status: str
    start_time: Optional[datetime]
    duration_minutes: int
    is_seed: Optional[bool] = False
    created_at: datetime
    started_at: Optional[datetime]
    ended_at: Optional[datetime]

    @field_serializer("start_time", "created_at", "started_at", "ended_at")
    def serialize_meeting_datetimes(self, v: Optional[datetime], _info) -> Optional[str]:
        return _serialize_utc(v)

    model_config = {"from_attributes": True}


# ── Participant ───────────────────────────────────────────────────────────────

class JoinRequest(BaseModel):
    display_name: str
    as_host: bool = False


class ParticipantUpdate(BaseModel):
    is_muted: Optional[bool] = None
    is_video_on: Optional[bool] = None


class ParticipantOut(BaseModel):
    id: int
    meeting_id: int
    user_id: Optional[int]
    display_name: str
    role: str
    is_muted: bool
    is_video_on: bool
    status: str
    joined_at: datetime
    left_at: Optional[datetime]

    @field_serializer("joined_at", "left_at")
    def serialize_participant_datetimes(self, v: Optional[datetime], _info) -> Optional[str]:
        return _serialize_utc(v)

    model_config = {"from_attributes": True}
