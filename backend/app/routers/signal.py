"""WebSocket signaling for WebRTC peer-to-peer mesh media."""

import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app import models

router = APIRouter(tags=["webrtc"])

# In-memory rooms: code -> participant_id -> WebSocket
rooms: dict[str, dict[int, WebSocket]] = {}


def close_participant_socket(code: str, pid: int):
    """Close and remove a specific participant's socket (e.g. on host removal)."""
    if code in rooms and pid in rooms[code]:
        ws = rooms[code].pop(pid, None)
        if ws:
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    loop.create_task(ws.close(code=status.WS_1000_NORMAL_CLOSURE))
            except Exception:
                pass


def close_room(code: str):
    """Close all participant sockets in a meeting room (e.g. on host end)."""
    if code in rooms:
        target_ws_list = list(rooms.pop(code, {}).values())
        for ws in target_ws_list:
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    loop.create_task(ws.close(code=status.WS_1000_NORMAL_CLOSURE))
            except Exception:
                pass


@router.websocket("/ws/{code}")
async def websocket_signaling(
    websocket: WebSocket,
    code: str,
    pid: int = Query(...),
    db: Session = Depends(get_db),
):
    """Signaling endpoint for exchanging SDP offers, answers and ICE candidates."""
    # Validate participant belongs to meeting and is status=joined
    meeting = db.query(models.Meeting).filter_by(meeting_code=code).first()
    if not meeting:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    participant = (
        db.query(models.Participant)
        .filter_by(id=pid, meeting_id=meeting.id, status=models.ParticipantStatus.joined)
        .first()
    )
    if not participant:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await websocket.accept()

    if code not in rooms:
        rooms[code] = {}

    # Send existing peer IDs to the newly connected participant
    existing_ids = list(rooms[code].keys())
    await websocket.send_json({"type": "peers", "ids": existing_ids})

    # Register socket
    rooms[code][pid] = websocket

    try:
        while True:
            msg = await websocket.receive_json()
            target_id = msg.get("to")
            msg_type = msg.get("type")
            data = msg.get("data")

            # Forward message to recipient as from sender
            if target_id and code in rooms and target_id in rooms[code]:
                target_ws = rooms[code][target_id]
                await target_ws.send_json({
                    "from": pid,
                    "type": msg_type,
                    "data": data,
                })
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        # Cleanup on disconnect
        if code in rooms and pid in rooms[code]:
            del rooms[code][pid]
            if not rooms[code]:
                del rooms[code]
            else:
                # Notify remaining peers that this participant left
                for ws in list(rooms[code].values()):
                    try:
                        await ws.send_json({"type": "left", "id": pid})
                    except Exception:
                        pass
