"""Meeting endpoints: create, list, get, delete, join, end, mute-all."""

from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy import or_, and_, nullslast
from sqlalchemy.orm import Session

from app import models, schemas
from app.database import get_db
from app.utils import generate_meeting_code, normalize_code
from app.seed import DEFAULT_USER_ID
from app.routers import auth

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
def create_meeting(
    body: schemas.MeetingCreate,
    current_user: Optional[models.User] = Depends(auth.get_current_user_optional),
    db: Session = Depends(get_db),
):
    """Create an instant meeting (no start_time) or a scheduled one."""
    user = current_user or db.query(models.User).filter_by(id=DEFAULT_USER_ID).first()
    host_id = user.id

    if body.start_time is None:
        # Instant meeting: live immediately
        meeting = models.Meeting(
            meeting_code=generate_meeting_code(db),
            title=body.title or f"{user.name}'s Meeting",
            description=body.description,
            host_id=host_id,
            type=models.MeetingType.instant,
            status=models.MeetingStatus.live,
            started_at=datetime.utcnow(),
            duration_minutes=body.duration_minutes or 30,
            is_seed=False,
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
            host_id=host_id,
            type=models.MeetingType.scheduled,
            status=models.MeetingStatus.scheduled,
            start_time=st,
            duration_minutes=body.duration_minutes or 30,
            is_seed=False,
        )

    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return meeting


# ── List ──────────────────────────────────────────────────────────────────────

@router.get("/upcoming", response_model=list[schemas.MeetingOut])
def upcoming_meetings(
    current_user: Optional[models.User] = Depends(auth.get_current_user_optional),
    db: Session = Depends(get_db),
):
    """Return scheduled seed meetings + meetings created by the authenticated user.
    Guests (no token) see only seed meetings."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Build filter: always include seeds; add user's own meetings only if logged in
    if current_user:
        user_filter = or_(
            models.Meeting.is_seed == True,
            models.Meeting.host_id == current_user.id,
        )
    else:
        # Guest: seeds only — do NOT fall back to DEFAULT_USER_ID
        user_filter = (models.Meeting.is_seed == True)

    results = (
        db.query(models.Meeting)
        .filter(
            user_filter,
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
                user_filter,
                models.Meeting.status == models.MeetingStatus.scheduled,
                models.Meeting.start_time >= now,
            )
            .order_by(models.Meeting.start_time.asc())
            .all()
        )
    return results


@router.get("/recent", response_model=list[schemas.MeetingOut])
def recent_meetings(
    current_user: Optional[models.User] = Depends(auth.get_current_user_optional),
    db: Session = Depends(get_db),
):
    """Return meetings the user has participated in (live OR ended).
    Seeds are included only when ended. Guests see only ended seed meetings."""

    if current_user:
        uid = current_user.id
        # Meetings where the user has a participant row (any status)
        attended_ids = [
            p.meeting_id
            for p in db.query(models.Participant.meeting_id).filter_by(user_id=uid).all()
        ]
        # Seeds: only when ended (they're never actually "live" for real users)
        seed_filter = and_(
            models.Meeting.is_seed == True,
            models.Meeting.status == models.MeetingStatus.ended,
        )
        # User's own or attended meetings: live OR ended (so they can rejoin if live)
        participated_filter = and_(
            or_(
                models.Meeting.host_id == uid,
                models.Meeting.id.in_(attended_ids),
            ),
            models.Meeting.status.in_([
                models.MeetingStatus.live,
                models.MeetingStatus.ended,
            ]),
        )
        meeting_filter = or_(seed_filter, participated_filter)
    else:
        # Guest: only ended seed meetings
        meeting_filter = and_(
            models.Meeting.is_seed == True,
            models.Meeting.status == models.MeetingStatus.ended,
        )

    return (
        db.query(models.Meeting)
        .filter(meeting_filter)
        # Use started_at for ordering — ended_at is NULL for live meetings
        .order_by(nullslast(models.Meeting.started_at.desc()))
        .limit(15)
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
    current_user: Optional[models.User] = Depends(auth.get_current_user_optional),
    db: Session = Depends(get_db),
):
    """Delete a scheduled meeting (host only)."""
    meeting = get_meeting_or_404(db, code)
    if current_user and current_user.id == meeting.host_id:
        pass  # Meeting creator is authorized
    else:
        require_host(db, meeting.meeting_code, x_participant_id)
    db.delete(meeting)
    db.commit()


# ── Join ──────────────────────────────────────────────────────────────────────

@router.post("/{code}/join", response_model=schemas.ParticipantOut, status_code=201)
def join_meeting(
    code: str,
    body: schemas.JoinRequest,
    current_user: Optional[models.User] = Depends(auth.get_current_user_optional),
    db: Session = Depends(get_db),
):
    """Add a participant to the meeting. Flips status to live on first join."""
    meeting = get_meeting_or_404(db, code)
    if meeting.status == models.MeetingStatus.ended:
        raise HTTPException(status_code=400, detail="This meeting has ended")

    # Flip scheduled -> live on first join
    if meeting.status == models.MeetingStatus.scheduled:
        meeting.status = models.MeetingStatus.live
        meeting.started_at = datetime.utcnow()

    # Determine if requester is the actual meeting host
    is_meeting_host = False
    if current_user and current_user.id == meeting.host_id:
        is_meeting_host = True
    elif not current_user and meeting.host_id == DEFAULT_USER_ID:
        is_meeting_host = True

    role = (
        models.ParticipantRole.host
        if body.as_host and is_meeting_host
        else models.ParticipantRole.participant
    )

    participant_user_id = None
    if current_user:
        participant_user_id = current_user.id
    elif role == models.ParticipantRole.host and meeting.host_id == DEFAULT_USER_ID:
        participant_user_id = DEFAULT_USER_ID

    participant = models.Participant(
        meeting_id=meeting.id,
        user_id=participant_user_id,
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
