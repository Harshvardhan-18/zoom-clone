"""Participant endpoints: list, update self, leave, remove."""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

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


@router.get(
    "/meetings/{code}/participants", response_model=list[schemas.ParticipantOut]
)
def list_participants(code: str, db: Session = Depends(get_db)):
    """Return all joined participants for a meeting."""
    normalized = normalize_code(code)
    meeting = db.query(models.Meeting).filter_by(meeting_code=normalized).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Invalid meeting ID")
    return [
        p for p in meeting.participants if p.status == models.ParticipantStatus.joined
    ]


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


@router.post(
    "/participants/{participant_id}/leave", response_model=schemas.ParticipantOut
)
def leave_meeting(participant_id: int, db: Session = Depends(get_db)):
    """Mark a participant as left. If the leaver is the host, transfer host
    role to a random remaining participant, or end the meeting if no one else
    is still joined."""
    p = get_participant_or_404(db, participant_id)
    p.status = models.ParticipantStatus.left
    p.left_at = datetime.utcnow()
    db.commit()

    # ── Host-transfer / meeting-end logic ────────────────────────────────────
    if p.role == models.ParticipantRole.host:
        # Find remaining joined participants (exclude the one who just left)
        remaining = (
            db.query(models.Participant)
            .filter(
                models.Participant.meeting_id == p.meeting_id,
                models.Participant.status == models.ParticipantStatus.joined,
                models.Participant.id != p.id,
            )
            .all()
        )

        meeting = db.query(models.Meeting).filter_by(id=p.meeting_id).first()

        if remaining:
            # Promote a random participant to host
            import random
            new_host = random.choice(remaining)
            new_host.role = models.ParticipantRole.host
            db.commit()

            # Notify the room via WebSocket so UI updates instantly
            try:
                from app.routers.signal import broadcast_to_room
                if meeting:
                    broadcast_to_room(
                        meeting.meeting_code,
                        {"type": "host_changed", "new_host_id": new_host.id},
                    )
            except Exception:
                pass  # Non-critical — polling will catch the role change
        elif meeting and meeting.status == models.MeetingStatus.live:
            # No one left — end the meeting so it appears in recents
            meeting.status = models.MeetingStatus.ended
            meeting.ended_at = datetime.utcnow()
            db.commit()

            try:
                from app.routers.signal import close_room
                close_room(meeting.meeting_code)
            except Exception:
                pass

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
        raise HTTPException(
            status_code=403, detail="Participant does not belong to this meeting"
        )

    target.status = models.ParticipantStatus.removed
    target.left_at = datetime.utcnow()
    db.commit()

    meeting = db.query(models.Meeting).filter_by(id=target.meeting_id).first()
    if meeting:
        from app.routers.signal import close_participant_socket

        close_participant_socket(meeting.meeting_code, participant_id)
