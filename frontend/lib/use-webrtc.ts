"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getApiBase } from "./api";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
];

/**
 * Native WebRTC mesh hook.
 * Uses FastAPI WebSocket signaling to exchange SDP offers, answers, and ICE candidates.
 */
export function useWebRTC(
  code: string,
  participantId: number,
  localStream: MediaStream | null,
  onRemoved?: () => void,
  onHostChanged?: (newHostId: number) => void
) {
  const [remoteStreams, setRemoteStreams] = useState<Record<number, MediaStream>>({});
  const pcsRef = useRef<Map<number, RTCPeerConnection>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(localStream);
  const iceQueuesRef = useRef<Map<number, RTCIceCandidateInit[]>>(new Map());
  const pendingPeerIdsRef = useRef<number[]>([]);

  // Keep local stream ref in sync
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  // When localStream becomes available, add tracks to any already-created PCs
  // AND process any peers that arrived before the stream was ready
  useEffect(() => {
    if (!localStream) return;

    // Add tracks to existing peer connections that don't have them yet
    pcsRef.current.forEach((pc) => {
      const senders = pc.getSenders();
      localStream.getTracks().forEach((track) => {
        const alreadyAdded = senders.some((s) => s.track?.kind === track.kind);
        if (!alreadyAdded) {
          pc.addTrack(track, localStream);
        }
      });
    });

    // Process peers that joined before stream was ready (re-negotiate)
    const pending = pendingPeerIdsRef.current.splice(0);
    for (const peerId of pending) {
      const pc = pcsRef.current.get(peerId);
      if (pc && wsRef.current?.readyState === WebSocket.OPEN) {
        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer).then(() => offer))
          .then((offer) => {
            wsRef.current?.send(
              JSON.stringify({ to: peerId, type: "offer", data: offer })
            );
          })
          .catch(() => {});
      }
    }
  }, [localStream]);

  const createPCCallback = useCallback(
    (ws: WebSocket) =>
      (peerId: number): RTCPeerConnection => {
        // Close any old PC for this peer
        const existing = pcsRef.current.get(peerId);
        if (existing) {
          existing.close();
        }

        const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
        pcsRef.current.set(peerId, pc);

        // Add local tracks if stream is ready
        const stream = localStreamRef.current;
        if (stream) {
          stream.getTracks().forEach((track) => {
            pc.addTrack(track, stream);
          });
        }

        // When we receive remote tracks, store the stream
        pc.ontrack = (event) => {
          const incomingStream = event.streams[0];
          if (incomingStream) {
            setRemoteStreams((prev) => ({ ...prev, [peerId]: incomingStream }));
          } else {
            // Fallback: build stream manually from track
            setRemoteStreams((prev) => {
              const existing = prev[peerId] || new MediaStream();
              if (!existing.getTracks().some((t) => t.id === event.track.id)) {
                existing.addTrack(event.track);
              }
              return { ...prev, [peerId]: existing };
            });
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate && ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({
                to: peerId,
                type: "ice",
                data: event.candidate,
              })
            );
          }
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "failed") {
            // Attempt ICE restart on failure
            pc.restartIce();
          }
        };

        return pc;
      },
    []
  );

  useEffect(() => {
    if (!code || !participantId) return;

    // Derive WS/WSS URL from dynamic API base
    const base = getApiBase();
    const wsBase = base.replace(/^https?:/, (m) => (m === "https:" ? "wss:" : "ws:"));
    const wsUrl = `${wsBase}/ws/${code}?pid=${participantId}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    const createPC = createPCCallback(ws);

    async function drainIceQueue(peerId: number, pc: RTCPeerConnection) {
      const queue = iceQueuesRef.current.get(peerId) || [];
      iceQueuesRef.current.delete(peerId);
      for (const cand of queue) {
        await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
      }
    }

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);

        // 1. Initial peers list: We are the new joiner → create PCs and send offers
        if (msg.type === "peers" && Array.isArray(msg.ids)) {
          for (const peerId of msg.ids) {
            const pc = createPC(peerId);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({ to: peerId, type: "offer", data: offer })
              );
            }

            // If stream wasn't ready yet, queue this peer for re-negotiation
            if (!localStreamRef.current) {
              pendingPeerIdsRef.current.push(peerId);
            }
          }
        }

        // 2. Incoming offer: Existing peer receives offer from new joiner → answer
        if (msg.type === "offer" && msg.from) {
          const peerId = msg.from;
          let pc = pcsRef.current.get(peerId);
          if (!pc) {
            pc = createPC(peerId);
          }
          await pc.setRemoteDescription(new RTCSessionDescription(msg.data));
          await drainIceQueue(peerId, pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              JSON.stringify({ to: peerId, type: "answer", data: answer })
            );
          }
        }

        // 3. Incoming answer
        if (msg.type === "answer" && msg.from) {
          const peerId = msg.from;
          const pc = pcsRef.current.get(peerId);
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.data));
            await drainIceQueue(peerId, pc);
          }
        }

        // 4. Incoming ICE candidate
        if (msg.type === "ice" && msg.from) {
          const peerId = msg.from;
          const pc = pcsRef.current.get(peerId);
          if (pc && pc.remoteDescription?.type) {
            await pc.addIceCandidate(new RTCIceCandidate(msg.data)).catch(() => {});
          } else {
            // Queue until remote description is set
            const q = iceQueuesRef.current.get(peerId) || [];
            q.push(msg.data);
            iceQueuesRef.current.set(peerId, q);
          }
        }

        // 5. Peer left
        if (msg.type === "left" && msg.id) {
          const peerId = msg.id;
          const pc = pcsRef.current.get(peerId);
          if (pc) {
            pc.close();
            pcsRef.current.delete(peerId);
          }
          iceQueuesRef.current.delete(peerId);
          setRemoteStreams((prev) => {
            const next = { ...prev };
            delete next[peerId];
            return next;
          });
        }

        // 6. Kicked / removed by host
        if (msg.type === "removed") {
          onRemoved?.();
        }

        // 7. Host transferred to another participant
        if (msg.type === "host_changed" && msg.new_host_id) {
          onHostChanged?.(msg.new_host_id);
        }
      } catch (err) {
        console.error("WebRTC signaling error:", err);
      }
    };

    ws.onerror = (err) => {
      console.error("WebSocket error:", err);
    };

    return () => {
      pcsRef.current.forEach((pc) => pc.close());
      pcsRef.current.clear();
      iceQueuesRef.current.clear();
      pendingPeerIdsRef.current = [];
      setRemoteStreams({});
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      wsRef.current = null;
    };
  }, [code, participantId, createPCCallback]);

  return remoteStreams;
}
