"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Info, Copy } from "lucide-react";
import { toast, Toaster } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import VideoTile from "@/components/meeting-room/video-tile";
import ControlBar from "@/components/meeting-room/control-bar";
import ParticipantsPanel from "@/components/meeting-room/participants-panel";
import {
  getMeeting,
  listParticipants,
  updateParticipant,
  leaveParticipant,
  endMeeting,
  type Meeting,
  type Participant,
} from "@/lib/api";
import { formatMeetingId, inviteLink, formatElapsed, cn } from "@/lib/utils";
import { useWebRTC } from "@/lib/use-webrtc";

function getGridClass(count: number): string {
  if (count <= 1) return "grid-cols-1 grid-rows-1";
  if (count === 2) return "grid-cols-1 md:grid-cols-2 grid-rows-2 md:grid-rows-1";
  if (count <= 4) return "grid-cols-2 grid-rows-2";
  return "grid-cols-2 md:grid-cols-3 auto-rows-fr";
}

export default function MeetingRoomPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();

  // Participant id stored in sessionStorage by prejoin
  const participantId = Number(
    typeof window !== "undefined"
      ? sessionStorage.getItem(`participant:${code}`) ?? "0"
      : "0"
  );

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [self, setSelf] = useState<Participant | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);

  // WebRTC mesh: exchange audio/video peer-to-peer
  const remoteStreams = useWebRTC(code, participantId, stream);

  const streamRef = useRef<MediaStream | null>(null);
  const leavingRef = useRef(false);

  // Redirect to pre-join if no participant ID
  useEffect(() => {
    if (!participantId) {
      router.replace(`/j/${code}`);
    }
  }, [participantId, code, router]);

  // Acquire local media
  useEffect(() => {
    navigator.mediaDevices
      ?.getUserMedia({ video: true, audio: true })
      .then((s) => {
        streamRef.current = s;
        setStream(s);
      })
      .catch(() => {});

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Elapsed timer ticking every 1s
  useEffect(() => {
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Polling every 2s
  const poll = useCallback(async () => {
    if (leavingRef.current || !participantId) return;
    try {
      const [m, parts] = await Promise.all([
        getMeeting(code),
        listParticipants(code),
      ]);
      setMeeting(m);
      setParticipants(parts);

      const me = parts.find((p) => p.id === participantId);
      if (me) setSelf(me);

      // Kicked by host?
      if (me?.status === "removed") {
        leavingRef.current = true;
        streamRef.current?.getTracks().forEach((t) => t.stop());
        toast.error("You were removed by the host");
        router.push("/");
        return;
      }

      // Meeting ended?
      if (m.status === "ended") {
        leavingRef.current = true;
        streamRef.current?.getTracks().forEach((t) => t.stop());
        toast.info("The host ended this meeting");
        router.push("/");
        return;
      }

      // Muted by host?
      if (me && me.is_muted && micOn) {
        streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = false));
        setMicOn(false);
      }
    } catch {
      // Ignore transient network errors
    }
  }, [code, participantId, micOn, router]);

  useEffect(() => {
    poll();
    const timer = setInterval(poll, 2000);
    return () => clearInterval(timer);
  }, [poll]);

  // SendBeacon on tab close
  useEffect(() => {
    const handleUnload = () => {
      if (!participantId || leavingRef.current) return;
      const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
      navigator.sendBeacon(`${base}/api/participants/${participantId}/leave`);
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [participantId]);

  async function toggleMic() {
    const next = !micOn;
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = next));
    setMicOn(next);
    if (participantId) {
      await updateParticipant(participantId, { is_muted: !next }).catch(() => {});
    }
  }

  async function toggleCam() {
    const next = !camOn;
    streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = next));
    setCamOn(next);
    if (participantId) {
      await updateParticipant(participantId, { is_video_on: next }).catch(() => {});
    }
  }

  async function handleLeave() {
    if (leavingRef.current) return;
    leavingRef.current = true;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    try {
      await leaveParticipant(participantId);
    } catch {}
    sessionStorage.removeItem(`participant:${code}`);
    router.push("/");
  }

  async function handleEnd() {
    if (leavingRef.current) return;
    leavingRef.current = true;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    try {
      await endMeeting(code, participantId);
    } catch {}
    sessionStorage.removeItem(`participant:${code}`);
    router.push("/");
  }

  const isHost = self?.role === "host";
  const link = inviteLink(code);

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0F0F0F] text-white overflow-hidden select-none">
      {/* Dark theme sonner toasts for room */}
      <Toaster theme="dark" position="top-right" richColors />

      {/* Top bar (h-12, bg #0F0F0F) */}
      <header className="h-12 bg-[#0F0F0F] flex items-center justify-between px-4 shrink-0 border-b border-white/5 z-10">
        {/* Left: Info pill with meeting title */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="bg-white/10 hover:bg-white/15 text-white rounded-full px-3 py-1 flex items-center gap-2 text-sm font-semibold cursor-pointer transition-colors">
              <Info size={16} />
              <span className="truncate max-w-[200px] sm:max-w-[400px]">
                {meeting?.title || "Meeting"}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="bg-[#242424] border border-white/10 text-white rounded-xl p-4 w-80 shadow-2xl"
          >
            <p className="text-xs text-[#6E6E85] mb-1 font-medium">Meeting ID</p>
            <p className="text-base font-semibold text-white font-mono tracking-wide mb-3">
              {formatMeetingId(code)}
            </p>
            <p className="text-xs text-[#6E6E85] mb-1 font-medium">Invite link</p>
            <div className="flex items-center gap-2 bg-[#1C1C1C] rounded-lg p-2 border border-white/5">
              <span className="text-xs text-white/90 break-all select-all flex-1 line-clamp-2">
                {link}
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(link);
                  toast.success("Invite link copied!");
                }}
                className="p-1.5 rounded-md hover:bg-white/10 text-white/70 hover:text-white transition-colors cursor-pointer shrink-0"
                title="Copy Link"
              >
                <Copy size={14} />
              </button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Right: Elapsed timer (00:12:41) */}
        <div className="text-white/70 font-mono text-sm tabular-nums">
          {formatElapsed(elapsed)}
        </div>
      </header>

      {/* Main Body: Stage (shrinks when participants panel is open) + Docked Participants Panel */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Stage */}
        <main className="flex-1 min-w-0 h-full p-1 sm:p-2 bg-[#0F0F0F] flex items-center justify-center overflow-hidden">
          <div
            className={cn(
              "grid gap-1 w-full h-full max-h-full",
              getGridClass(participants.length)
            )}
          >
            {participants.map((p) => (
              <VideoTile
                key={p.id}
                participant={
                  p.id === participantId
                    ? { ...p, is_muted: !micOn, is_video_on: camOn }
                    : p
                }
                isSelf={p.id === participantId}
                stream={p.id === participantId ? stream : remoteStreams[p.id]}
              />
            ))}
          </div>
        </main>

        {/* Docked Participants Panel (right docked, shrinks stage) */}
        <ParticipantsPanel
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
          code={code}
          participants={participants}
          selfId={participantId}
          isHost={isHost}
          hostParticipantId={participantId}
          onRefresh={poll}
        />
      </div>

      {/* Control bar (h-[72px], bg #0F0F0F) */}
      <ControlBar
        micOn={micOn}
        camOn={camOn}
        participantCount={participants.length}
        isHost={isHost}
        panelOpen={panelOpen}
        onToggleMic={toggleMic}
        onToggleCam={toggleCam}
        onTogglePanel={() => setPanelOpen((v) => !v)}
        onLeave={handleLeave}
        onEnd={handleEnd}
      />
    </div>
  );
}
