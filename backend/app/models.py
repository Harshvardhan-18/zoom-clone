"""SQLAlchemy ORM models for users, meetings, and participants."""

import enum
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, ForeignKey, Enum, Index
)
from sqlalchemy.orm import relationship
from app.database import Base


class MeetingType(str, enum.Enum):
    instant = "instant"
    scheduled = "scheduled"


class MeetingStatus(str, enum.Enum):
    scheduled = "scheduled"
    live = "live"
    ended = "ended"


class ParticipantRole(str, enum.Enum):
    host = "host"
    participant = "participant"


class ParticipantStatus(str, enum.Enum):
    joined = "joined"
    left = "left"
    removed = "removed"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    avatar_color = Column(String, default="#0B5CFF")
    password_hash = Column(String, nullable=True)   # nullable so existing rows don't break
    created_at = Column(DateTime, default=datetime.utcnow)

    meetings = relationship("Meeting", back_populates="host")
    participations = relationship("Participant", back_populates="user")


class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(Integer, primary_key=True)
    meeting_code = Column(String(10), unique=True, nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=True)
    host_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    type = Column(Enum(MeetingType), nullable=False)
    status = Column(Enum(MeetingStatus), default=MeetingStatus.scheduled)
    start_time = Column(DateTime, nullable=True)
    duration_minutes = Column(Integer, default=30)
    created_at = Column(DateTime, default=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)
    ended_at = Column(DateTime, nullable=True)

    host = relationship("User", back_populates="meetings")
    participants = relationship(
        "Participant", back_populates="meeting", cascade="all, delete-orphan"
    )


class Participant(Base):
    __tablename__ = "participants"

    id = Column(Integer, primary_key=True)
    meeting_id = Column(
        Integer, ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    display_name = Column(String, nullable=False)
    role = Column(Enum(ParticipantRole), nullable=False)
    is_muted = Column(Boolean, default=False)
    is_video_on = Column(Boolean, default=True)
    status = Column(Enum(ParticipantStatus), default=ParticipantStatus.joined)
    joined_at = Column(DateTime, default=datetime.utcnow)
    left_at = Column(DateTime, nullable=True)

    meeting = relationship("Meeting", back_populates="participants")
    user = relationship("User", back_populates="participations")
