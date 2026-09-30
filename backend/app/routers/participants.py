"""Participant endpoints: list, update self, leave, remove."""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional

from app import models, schemas
from app.database import get_db
from app.utils import normalize_code

router = APIRouter(prefix="/api", tags=["participants"])


def get_participant_or_404(db: Session, participant_id: int) -> models.Participant:
    p = db.query(models.Participant).filter_by(id=participant_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Participant not found")
    return p


# ── List participants in a meeting ────────────────────────────────────────────

@router.get("/meetings/{code}/participants", response_model=list[schemas.ParticipantOut])
def list_participants(code: str, db: Session = Depends(get_db)):
    """Return all joined participants for a meeting."""
    normalized = normalize_code(code)
    meeting = db.query(models.Meeting).filter_by(meeting_code=normalized).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Invalid meeting ID")
    return [p for p in meeting.participants if p.status == models.ParticipantStatus.joined]


# ── Update self (mute / video toggle) ────────────────────────────────────────

@router.patch("/participants/{participant_id}", response_model=schemas.ParticipantOut)
def update_participant(
    participant_id: int, body: schemas.ParticipantUpdate, db: Session = Depends(get_db)
):
    """Let a participant update their own mute/video state."""
    p = get_participant_or_404(db, participant_id)
    if body.is_muted is not None:
        p.is_muted = body.is_muted
    if body.is_video_on is not None:
        p.is_video_on = body.is_video_on
    db.commit()
    db.refresh(p)
    return p


# ── Leave ─────────────────────────────────────────────────────────────────────

@router.post("/participants/{participant_id}/leave", response_model=schemas.ParticipantOut)
def leave_meeting(participant_id: int, db: Session = Depends(get_db)):
    """Mark a participant as left."""
    p = get_participant_or_404(db, participant_id)
    p.status = models.ParticipantStatus.left
    p.left_at = datetime.utcnow()
    db.commit()
    db.refresh(p)
    return p


# ── Remove (host only) ────────────────────────────────────────────────────────

@router.delete("/participants/{participant_id}", status_code=204)
def remove_participant(
    participant_id: int,
    x_participant_id: Optional[int] = Header(None),
    db: Session = Depends(get_db),
):
    """Remove a participant from the meeting (host only)."""
    target = get_participant_or_404(db, participant_id)

    # Verify caller is the host of the same meeting
    if x_participant_id is None:
        raise HTTPException(status_code=403, detail="Host participant ID required")
    host_p = db.query(models.Participant).filter_by(id=x_participant_id).first()
    if not host_p or host_p.role != models.ParticipantRole.host:
        raise HTTPException(status_code=403, detail="Host access required")
    if host_p.meeting_id != target.meeting_id:
        raise HTTPException(status_code=403, detail="Participant does not belong to this meeting")

    target.status = models.ParticipantStatus.removed
    target.left_at = datetime.utcnow()
    db.commit()

    meeting = db.query(models.Meeting).filter_by(id=target.meeting_id).first()
    if meeting:
        from app.routers.signal import close_participant_socket
        close_participant_socket(meeting.meeting_code, participant_id)
