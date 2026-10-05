"""WebSocket signaling for WebRTC peer-to-peer mesh media."""

import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query, status
from sqlalchemy.orm import Session
from app.database import get_db
from app import models
from app.utils import normalize_code

router = APIRouter(tags=["webrtc"])

# In-memory rooms: code -> participant_id -> WebSocket
rooms: dict[str, dict[int, WebSocket]] = {}


def close_participant_socket(code: str, pid: int):
    """Close and remove a specific participant's socket (e.g. on host removal)."""
    room_code = normalize_code(code)
    if room_code in rooms and pid in rooms[room_code]:
        ws = rooms[room_code].pop(pid, None)
        if ws:
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    async def notify_and_close():
                        try:
                            await ws.send_json({"type": "removed"})
                            await ws.close(code=status.WS_1000_NORMAL_CLOSURE)
                        except Exception:
                            pass
                    loop.create_task(notify_and_close())
            except Exception:
                pass


def close_room(code: str):
    """Close all participant sockets in a meeting room (e.g. on host end)."""
    room_code = normalize_code(code)
    if room_code in rooms:
        target_ws_list = list(rooms.pop(room_code, {}).values())
        for ws in target_ws_list:
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    loop.create_task(ws.close(code=status.WS_1000_NORMAL_CLOSURE))
            except Exception:
                pass


def broadcast_to_room(code: str, payload: dict):
    """Send a JSON payload to every socket in a room (fire-and-forget)."""
    room_code = normalize_code(code)
    if room_code not in rooms:
        return
    for ws in list(rooms[room_code].values()):
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                async def _send(w=ws):
                    try:
                        await w.send_json(payload)
                    except Exception:
                        pass
                loop.create_task(_send())
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
    room_code = normalize_code(code)

    # Validate: meeting must exist
    meeting = db.query(models.Meeting).filter_by(meeting_code=room_code).first()
    if not meeting:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # Validate: participant must exist and belong to this meeting
    # Accept both 'joined' and 'left' — a page refresh after reconnect may briefly show 'left'
    participant = (
        db.query(models.Participant)
        .filter_by(id=pid, meeting_id=meeting.id)
        .first()
    )
    if not participant or participant.status == models.ParticipantStatus.removed:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # If participant was marked left (e.g. from a previous disconnect), mark them joined again
    if participant.status == models.ParticipantStatus.left:
        participant.status = models.ParticipantStatus.joined
        participant.left_at = None
        db.commit()

    await websocket.accept()

    if room_code not in rooms:
        rooms[room_code] = {}

    # If this participant already has an old socket (reconnect scenario), close the old one
    old_ws = rooms[room_code].get(pid)
    if old_ws and old_ws is not websocket:
        try:
            await old_ws.close(code=status.WS_1000_NORMAL_CLOSURE)
        except Exception:
            pass

    # Send existing peer IDs to the newly connected participant
    existing_ids = [
        existing_pid
        for existing_pid in rooms[room_code].keys()
        if existing_pid != pid
    ]
    await websocket.send_json({"type": "peers", "ids": existing_ids})

    # Register socket AFTER sending peers list so we don't offer to ourselves
    rooms[room_code][pid] = websocket

    try:
        while True:
            msg = await websocket.receive_json()
            target_id = msg.get("to")
            msg_type = msg.get("type")
            data = msg.get("data")

            # Forward signaling message to the target peer
            if target_id and room_code in rooms and target_id in rooms[room_code]:
                target_ws = rooms[room_code][target_id]
                try:
                    await target_ws.send_json({
                        "from": pid,
                        "type": msg_type,
                        "data": data,
                    })
                except Exception:
                    pass  # Target peer may have disconnected — ignore
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        # Cleanup on disconnect
        if room_code in rooms and rooms[room_code].get(pid) is websocket:
            del rooms[room_code][pid]
            if not rooms[room_code]:
                del rooms[room_code]
            else:
                # Notify remaining peers that this participant left
                for ws in list(rooms[room_code].values()):
                    try:
                        await ws.send_json({"type": "left", "id": pid})
                    except Exception:
                        pass
