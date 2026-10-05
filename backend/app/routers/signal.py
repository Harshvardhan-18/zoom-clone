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
    # Validate participant belongs to meeting and is status=joined
    meeting = db.query(models.Meeting).filter_by(meeting_code=room_code).first()
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

    if room_code not in rooms:
        rooms[room_code] = {}

    # Send existing peer IDs to the newly connected participant
    existing_ids = list(rooms[room_code].keys())
    await websocket.send_json({"type": "peers", "ids": existing_ids})

    # Register socket
    rooms[room_code][pid] = websocket

    try:
        while True:
            msg = await websocket.receive_json()
            target_id = msg.get("to")
            msg_type = msg.get("type")
            data = msg.get("data")

            # Forward message to recipient as from sender
            if target_id and room_code in rooms and target_id in rooms[room_code]:
                target_ws = rooms[room_code][target_id]
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
        if room_code in rooms and pid in rooms[room_code]:
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
