"""Meeting endpoints: create, list, get, delete, join, end, mute-all."""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional

from app import models, schemas
from app.database import get_db
from app.utils import generate_meeting_code, normalize_code
from app.seed import DEFAULT_USER_ID

router = APIRouter(prefix="/api/meetings", tags=["meetings"])


def require_host(db: Session, code: str, participant_id: Optional[int]) -> models.Participant:
    """Load participant by id and verify they are the host of the given meeting."""
    if participant_id is None:
        raise HTTPException(status_code=403, detail="Host participant ID required")
    p = db.query(models.Participant).filter_by(id=participant_id).first()
    if not p or p.role != models.ParticipantRole.host:
        raise HTTPException(status_code=403, detail="Host access required")
    if p.meeting.meeting_code != code:
        raise HTTPException(status_code=403, detail="Participant does not belong to this meeting")
    return p


def get_meeting_or_404(db: Session, code: str) -> models.Meeting:
    """Return the meeting for the given code or raise 404."""
    normalized = normalize_code(code)
    meeting = db.query(models.Meeting).filter_by(meeting_code=normalized).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="Invalid meeting ID")
    return meeting


# ── Create ────────────────────────────────────────────────────────────────────

@router.post("", response_model=schemas.MeetingOut, status_code=201)
def create_meeting(body: schemas.MeetingCreate, db: Session = Depends(get_db)):
    """Create an instant meeting (no start_time) or a scheduled one."""
    user = db.query(models.User).filter_by(id=DEFAULT_USER_ID).first()

    if body.start_time is None:
        # Instant meeting: live immediately
        meeting = models.Meeting(
            meeting_code=generate_meeting_code(db),
            title=body.title or f"{user.name}'s Meeting",
            description=body.description,
            host_id=DEFAULT_USER_ID,
            type=models.MeetingType.instant,
            status=models.MeetingStatus.live,
            started_at=datetime.utcnow(),
            duration_minutes=body.duration_minutes or 30,
        )
    else:
        st = body.start_time
        if st.tzinfo is not None:
            st = st.astimezone(timezone.utc).replace(tzinfo=None)
        if st <= datetime.utcnow():
            raise HTTPException(status_code=400, detail="start_time must be in the future")
        if not body.title:
            raise HTTPException(status_code=400, detail="title is required for scheduled meetings")
        meeting = models.Meeting(
            meeting_code=generate_meeting_code(db),
            title=body.title,
            description=body.description,
            host_id=DEFAULT_USER_ID,
            type=models.MeetingType.scheduled,
            status=models.MeetingStatus.scheduled,
            start_time=st,
            duration_minutes=body.duration_minutes or 30,
        )

    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return meeting


# ── List ──────────────────────────────────────────────────────────────────────

@router.get("/upcoming", response_model=list[schemas.MeetingOut])
def upcoming_meetings(db: Session = Depends(get_db)):
    """Return scheduled meetings with start_time in the future, soonest first."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    results = (
        db.query(models.Meeting)
        .filter(
            models.Meeting.host_id == DEFAULT_USER_ID,
            models.Meeting.status == models.MeetingStatus.scheduled,
            models.Meeting.start_time >= now,
        )
        .order_by(models.Meeting.start_time.asc())
        .all()
    )
    if not results:
        from app.seed import seed_if_empty
        seed_if_empty(db)
        results = (
            db.query(models.Meeting)
            .filter(
                models.Meeting.host_id == DEFAULT_USER_ID,
                models.Meeting.status == models.MeetingStatus.scheduled,
                models.Meeting.start_time >= now,
            )
            .order_by(models.Meeting.start_time.asc())
            .all()
        )
    return results


@router.get("/recent", response_model=list[schemas.MeetingOut])
def recent_meetings(db: Session = Depends(get_db)):
    """Return ended meetings for the default user, newest first, up to 10."""
    return (
        db.query(models.Meeting)
        .filter(
            models.Meeting.host_id == DEFAULT_USER_ID,
            models.Meeting.status == models.MeetingStatus.ended,
        )
        .order_by(models.Meeting.ended_at.desc())
        .limit(10)
        .all()
    )


# ── Single meeting ────────────────────────────────────────────────────────────

@router.get("/{code}", response_model=schemas.MeetingOut)
def get_meeting(code: str, db: Session = Depends(get_db)):
    """Fetch a single meeting by code (or invite URL). Returns even if ended."""
    return get_meeting_or_404(db, code)


@router.delete("/{code}", status_code=204)
def delete_meeting(
    code: str,
    x_participant_id: Optional[int] = Header(None),
    db: Session = Depends(get_db),
):
    """Delete a scheduled meeting (host only)."""
    meeting = get_meeting_or_404(db, code)
    require_host(db, meeting.meeting_code, x_participant_id)
    db.delete(meeting)
    db.commit()


# ── Join ──────────────────────────────────────────────────────────────────────

@router.post("/{code}/join", response_model=schemas.ParticipantOut, status_code=201)
def join_meeting(code: str, body: schemas.JoinRequest, db: Session = Depends(get_db)):
    """Add a participant to the meeting. Flips status to live on first join."""
    meeting = get_meeting_or_404(db, code)
    if meeting.status == models.MeetingStatus.ended:
        raise HTTPException(status_code=400, detail="This meeting has ended")

    # Flip scheduled -> live on first join
    if meeting.status == models.MeetingStatus.scheduled:
        meeting.status = models.MeetingStatus.live
        meeting.started_at = datetime.utcnow()

    # Only grant host role if requester is the actual host
    role = (
        models.ParticipantRole.host
        if body.as_host and meeting.host_id == DEFAULT_USER_ID
        else models.ParticipantRole.participant
    )

    participant = models.Participant(
        meeting_id=meeting.id,
        user_id=DEFAULT_USER_ID if body.as_host else None,
        display_name=body.display_name,
        role=role,
        is_muted=False,
        is_video_on=True,
    )
    db.add(participant)
    db.commit()
    db.refresh(participant)
    return participant


# ── End ───────────────────────────────────────────────────────────────────────

@router.post("/{code}/end", response_model=schemas.MeetingOut)
def end_meeting(
    code: str,
    x_participant_id: Optional[int] = Header(None),
    db: Session = Depends(get_db),
):
    """End the meeting and mark all joined participants as left (host only)."""
    meeting = get_meeting_or_404(db, code)
    require_host(db, meeting.meeting_code, x_participant_id)

    meeting.status = models.MeetingStatus.ended
    meeting.ended_at = datetime.utcnow()

    # Mark every joined participant as left
    for p in meeting.participants:
        if p.status == models.ParticipantStatus.joined:
            p.status = models.ParticipantStatus.left
            p.left_at = meeting.ended_at

    db.commit()
    db.refresh(meeting)

    from app.routers.signal import close_room
    close_room(meeting.meeting_code)

    return meeting


# ── Mute all ──────────────────────────────────────────────────────────────────

@router.post("/{code}/mute-all", response_model=list[schemas.ParticipantOut])
def mute_all(
    code: str,
    x_participant_id: Optional[int] = Header(None),
    db: Session = Depends(get_db),
):
    """Mute every joined non-host participant (host only)."""
    meeting = get_meeting_or_404(db, code)
    require_host(db, meeting.meeting_code, x_participant_id)

    muted = []
    for p in meeting.participants:
        if p.status == models.ParticipantStatus.joined and p.role != models.ParticipantRole.host:
            p.is_muted = True
            muted.append(p)

    db.commit()
    return muted
