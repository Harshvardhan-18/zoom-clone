"use client";

import { useEffect, useRef, useState } from "react";
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
  onRemoved?: () => void
) {
  const [remoteStreams, setRemoteStreams] = useState<Record<number, MediaStream>>({});
  const pcsRef = useRef<Map<number, RTCPeerConnection>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(localStream);
  const iceQueuesRef = useRef<Map<number, RTCIceCandidateInit[]>>(new Map());

  // Keep local stream ref in sync and add tracks if acquired after connection
  useEffect(() => {
    localStreamRef.current = localStream;
    if (localStream) {
      pcsRef.current.forEach((pc) => {
        const senders = pc.getSenders();
        localStream.getTracks().forEach((track) => {
          const alreadyAdded = senders.some((s) => s.track?.kind === track.kind);
          if (!alreadyAdded) {
            pc.addTrack(track, localStream);
          }
        });
      });
    }
  }, [localStream]);

  useEffect(() => {
    if (!code || !participantId) return;

    // Derive WS/WSS URL from dynamic API base
    const base = getApiBase();
    const wsBase = base.replace(/^https?:/, (m) => (m === "https:" ? "wss:" : "ws:"));
    const wsUrl = `${wsBase}/ws/${code}?pid=${participantId}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    function createPC(peerId: number): RTCPeerConnection {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcsRef.current.set(peerId, pc);

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      pc.ontrack = (event) => {
        setRemoteStreams((prev) => {
          let remote = prev[peerId];
          if (!remote) {
            remote = event.streams[0] || new MediaStream();
          }
          if (event.track && !remote.getTracks().some((t) => t.id === event.track.id)) {
            remote.addTrack(event.track);
          }
          return {
            ...prev,
            [peerId]: remote,
          };
        });
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

      return pc;
    }

    async function drainIceQueue(peerId: number, pc: RTCPeerConnection) {
      const queue = iceQueuesRef.current.get(peerId) || [];
      for (const cand of queue) {
        await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(() => {});
      }
      iceQueuesRef.current.delete(peerId);
    }

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);

        // 1. Initial peers list: We are the new joiner -> create PCs and send offers
        if (msg.type === "peers" && Array.isArray(msg.ids)) {
          for (const peerId of msg.ids) {
            const pc = createPC(peerId);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  to: peerId,
                  type: "offer",
                  data: offer,
                })
              );
            }
          }
        }

        // 2. Incoming offer: Existing peer receives offer from new joiner -> answer
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
              JSON.stringify({
                to: peerId,
                type: "answer",
                data: answer,
              })
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
          if (pc && pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(msg.data)).catch(() => {});
          } else {
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
      } catch (err) {
        console.error("WebRTC signaling error:", err);
      }
    };

    return () => {
      pcsRef.current.forEach((pc) => pc.close());
      pcsRef.current.clear();
      iceQueuesRef.current.clear();
      setRemoteStreams({});
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      wsRef.current = null;
    };
  }, [code, participantId, !!localStream]);

  return remoteStreams;
}
