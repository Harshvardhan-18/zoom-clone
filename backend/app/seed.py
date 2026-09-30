"""Seed the database with a default user and realistic meetings on first run."""

from datetime import datetime, timedelta
from app import models
from app.utils import generate_meeting_code

DEFAULT_USER_ID = 1


def seed_if_empty(db):
    """Insert default user + sample meetings only when the users table is empty."""
    if db.query(models.User).count() > 0:
        return

    # ── Default user ──────────────────────────────────────────────────────────
    user = models.User(
        id=DEFAULT_USER_ID,
        name="Alex Johnson",
        email="alex@example.com",
        avatar_color="#0B5CFF",
    )
    db.add(user)
    db.flush()  # ensure user.id is available for FK references

    now = datetime.utcnow()

    # ── 4 upcoming scheduled meetings ─────────────────────────────────────────
    upcoming = [
        ("Weekly Team Sync",       "Sprint review and weekly planning",            1),
        ("Design Review",          "Review new dashboard mockups with the team",   2),
        ("Client Onboarding Call", "Kick-off call for the new enterprise client",  3),
        ("1:1 with Manager",       "Monthly check-in and career development",      4),
    ]
    for title, desc, day_offset in upcoming:
        meeting = models.Meeting(
            meeting_code=generate_meeting_code(db),
            title=title,
            description=desc,
            host_id=DEFAULT_USER_ID,
            type=models.MeetingType.scheduled,
            status=models.MeetingStatus.scheduled,
            start_time=now + timedelta(days=day_offset, hours=2),
            duration_minutes=30,
        )
        db.add(meeting)

    db.flush()

    # ── 5 ended meetings in the past ──────────────────────────────────────────
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
