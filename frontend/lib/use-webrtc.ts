"use client";

import { useEffect, useRef, useState } from "react";

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

/**
 * Native WebRTC mesh hook.
 * Uses FastAPI WebSocket signaling to exchange SDP offers, answers, and ICE candidates.
 */
export function useWebRTC(
  code: string,
  participantId: number,
  localStream: MediaStream | null
) {
  const [remoteStreams, setRemoteStreams] = useState<Record<number, MediaStream>>({});
  const pcsRef = useRef<Map<number, RTCPeerConnection>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);
  const localStreamRef = useRef<MediaStream | null>(localStream);

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

    const base = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/+$/, "");
    const wsBase = base.replace(/^http/, "ws");
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
        if (event.streams && event.streams[0]) {
          setRemoteStreams((prev) => ({
            ...prev,
            [peerId]: event.streams[0],
          }));
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

      return pc;
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
          const pc = pcsRef.current.get(msg.from);
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(msg.data));
          }
        }

        // 4. Incoming ICE candidate
        if (msg.type === "ice" && msg.from) {
          const pc = pcsRef.current.get(msg.from);
          if (pc && msg.data) {
            await pc.addIceCandidate(new RTCIceCandidate(msg.data)).catch(() => {});
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
          setRemoteStreams((prev) => {
            const next = { ...prev };
            delete next[peerId];
            return next;
          });
        }
      } catch (err) {
        console.error("WebRTC signaling message error:", err);
      }
    };

    return () => {
      pcsRef.current.forEach((pc) => pc.close());
      pcsRef.current.clear();
      setRemoteStreams({});
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      wsRef.current = null;
    };
  }, [code, participantId]);

  return remoteStreams;
}
