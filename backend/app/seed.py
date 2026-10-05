"""Seed the database with a default user and realistic meetings on first run, and keep upcoming meetings fresh."""

from datetime import datetime, timedelta, timezone
from app import models
from app.utils import generate_meeting_code

DEFAULT_USER_ID = 1


def seed_upcoming_meetings(db, count: int = 4):
    """Seed fresh scheduled upcoming meetings starting from today/tomorrow."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    upcoming_templates = [
        ("Weekly Team Sync", "Sprint review, blocker check-in, and weekly planning", 1, 10),
        ("Design System Review", "Review new dashboard and component mockups with UX team", 2, 14),
        ("Client Onboarding Call", "Kick-off call and architecture alignment for the enterprise rollout", 3, 11),
        ("1:1 with Engineering Lead", "Monthly check-in, project milestones, and career development", 4, 16),
        ("Product Roadmap Q4", "Quarterly prioritization and release scheduling", 6, 15),
    ]

    for title, desc, day_offset, hour in upcoming_templates[:count]:
        target_date = (now + timedelta(days=day_offset)).replace(
            hour=hour, minute=0, second=0, microsecond=0
        )
        if target_date <= now:
            target_date += timedelta(days=1)

        meeting = models.Meeting(
            meeting_code=generate_meeting_code(db),
            title=title,
            description=desc,
            host_id=DEFAULT_USER_ID,
            type=models.MeetingType.scheduled,
            status=models.MeetingStatus.scheduled,
            start_time=target_date,
            duration_minutes=30,
        )
        db.add(meeting)

    db.commit()


def seed_if_empty(db):
    """Insert default user + sample meetings, and replenish upcoming meetings when none are upcoming."""
    import hashlib

    def _hash(pw: str) -> str:
        return hashlib.sha256(pw.encode()).hexdigest()

    DEFAULT_PASSWORD = "demo1234"

    # ── 1. Default user ──────────────────────────────────────────────────────────
    user = db.query(models.User).filter_by(id=DEFAULT_USER_ID).first()
    if not user:
        user = models.User(
            id=DEFAULT_USER_ID,
            name="Alex Johnson",
            email="alex@example.com",
            avatar_color="#0B5CFF",
            password_hash=_hash(DEFAULT_PASSWORD),
        )
        db.add(user)
        db.commit()
    elif not user.password_hash:
        # Backfill password for existing rows (e.g. after migration)
        user.password_hash = _hash(DEFAULT_PASSWORD)
        db.commit()

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # ── 2. Refresh upcoming meetings if expired or empty ─────────────────────────
    upcoming_count = (
        db.query(models.Meeting)
        .filter(
            models.Meeting.host_id == DEFAULT_USER_ID,
            models.Meeting.status == models.MeetingStatus.scheduled,
            models.Meeting.start_time >= now,
        )
        .count()
    )

    if upcoming_count < 2:
        seed_upcoming_meetings(db, count=4)

    # ── 3. Past ended meetings (only if none exist) ───────────────────────────────
    past_count = (
        db.query(models.Meeting)
        .filter(
            models.Meeting.host_id == DEFAULT_USER_ID,
            models.Meeting.status == models.MeetingStatus.ended,
        )
        .count()
    )

    if past_count == 0:
        past_meetings = [
            ("Product Roadmap Q4",     "Quarterly planning session",   1, 45, ["Alice Kim", "Bob Patel", "Carol Zhang"]),
            ("Engineering All-Hands",  "Company-wide engineering sync", 2, 60, ["Dan Wright", "Eva Müller"]),
            ("UX Feedback Session",    "User research findings review", 3, 30, ["Fiona Liu", "George Tan", "Hana Sato"]),
            ("Investor Update",        "Monthly investor briefing",     5, 30, ["Ian Ross", "Julia Chen"]),
            ("Sprint Retrospective",   "End-of-sprint retro",          7, 30, ["Kevin Park", "Laura White", "Mia Brown", "Noah Lee"]),
        ]
        for title, desc, day_offset, duration, guests in past_meetings:
            started = now - timedelta(days=day_offset, hours=2)
            ended   = started + timedelta(minutes=duration)
            meeting = models.Meeting(
                meeting_code=generate_meeting_code(db),
                title=title,
                description=desc,
                host_id=DEFAULT_USER_ID,
                type=models.MeetingType.instant,
                status=models.MeetingStatus.ended,
                start_time=started,
                duration_minutes=duration,
                started_at=started,
                ended_at=ended,
            )
            db.add(meeting)
            db.flush()

            # Host participant
            db.add(models.Participant(
                meeting_id=meeting.id,
                user_id=DEFAULT_USER_ID,
                display_name="Alex Johnson",
                role=models.ParticipantRole.host,
                is_muted=False,
                is_video_on=True,
                status=models.ParticipantStatus.left,
                joined_at=started,
                left_at=ended,
            ))
            # Guest participants
            for name in guests:
                db.add(models.Participant(
                    meeting_id=meeting.id,
                    display_name=name,
                    role=models.ParticipantRole.participant,
                    is_muted=False,
                    is_video_on=True,
                    status=models.ParticipantStatus.left,
                    joined_at=started + timedelta(minutes=1),
                    left_at=ended,
                ))

        db.commit()

