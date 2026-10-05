"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mic, MicOff, Video, VideoOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { type Meeting, joinMeeting, getMe } from "@/lib/api";
import { formatMeetingId, getInitial } from "@/lib/utils";
import { getStoredUser, setStoredUser } from "@/lib/user";

interface PreJoinProps {
  meeting: Meeting;
  defaultName?: string;
  asHost: boolean;
}

export default function PreJoin({ meeting, defaultName = "", asHost }: PreJoinProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [name, setName] = useState(defaultName);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [camError, setCamError] = useState(false);
  const [joining, setJoining] = useState(false);

  // Prefill with stored name or backend user
  useEffect(() => {
    const stored = getStoredUser();
    if (stored?.name && !defaultName) {
      setName(stored.name);
    } else if (!name) {
      getMe()
        .then((u) => {
          if (u?.name) setName(asHost ? u.name : "Guest Participant");
        })
        .catch(() => {});
    }
  }, [name, defaultName, asHost]);

  // Request camera + mic preview
  useEffect(() => {
    navigator.mediaDevices
      ?.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(() => {
        setCamError(true);
        setCamOn(false);
      });

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function toggleMic() {
    const next = !micOn;
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = next));
    setMicOn(next);
  }

  function toggleCam() {
    const next = !camOn;
    streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = next));
    setCamOn(next);
  }

  async function handleJoin() {
    if (!name.trim()) {
      toast.error("Please enter your name");
      return;
    }

    const trimmedName = name.trim();
    // Save in sessionStorage for this tab so room actions know this participant
    setStoredUser(trimmedName, "", true);

    setJoining(true);
    try {
      const participant = await joinMeeting(meeting.meeting_code, {
        display_name: trimmedName,
        as_host: asHost,
      });

      // Save participant ID to sessionStorage for host authentication & polling
      sessionStorage.setItem(
        `participant:${meeting.meeting_code}`,
        String(participant.id)
      );

      // Save mic/cam preferences so the meeting room can apply them on stream init
      sessionStorage.setItem(`micOn:${meeting.meeting_code}`, String(micOn));
      sessionStorage.setItem(`camOn:${meeting.meeting_code}`, String(camOn));

      // Stop preview tracks so meeting room can acquire stream freshly
      streamRef.current?.getTracks().forEach((t) => t.stop());

      router.push(`/meeting/${meeting.meeting_code}`);
    } catch (e: unknown) {
      toast.error((e as Error).message || "Failed to join meeting");
      setJoining(false);
    }
  }

  const initial = getInitial(name);

  return (
    <div className="bg-white rounded-2xl border border-[#E4E4ED] shadow-sm max-w-4xl w-full p-6 sm:p-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        {/* Left: 16:9 preview box */}
        <div className="flex flex-col items-center">
          <div className="aspect-video w-full bg-[#202020] rounded-xl relative overflow-hidden flex items-center justify-center">
            {camOn && !camError ? (
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover transform -scale-x-100"
              />
            ) : (
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-lg bg-[#3E8577] text-white flex items-center justify-center text-4xl sm:text-5xl font-medium select-none shadow-sm">
                {initial}
              </div>
            )}
          </div>

          {/* Toggle buttons below preview box */}
          <div className="flex items-center justify-center gap-4 mt-4">
            <button
              type="button"
              onClick={toggleMic}
              className={`p-3 rounded-full transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5CFF] ${
                micOn
                  ? "bg-[#EDEDF5] hover:bg-[#E4E4ED] text-[#232333]"
                  : "bg-[#E5484D] hover:bg-[#E5484D]/90 text-white"
              }`}
              aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
            >
              {micOn ? <Mic size={20} /> : <MicOff size={20} />}
            </button>
            <button
              type="button"
              onClick={toggleCam}
              disabled={camError}
              className={`p-3 rounded-full transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5CFF] ${
                camOn && !camError
                  ? "bg-[#EDEDF5] hover:bg-[#E4E4ED] text-[#232333]"
                  : "bg-[#E5484D] hover:bg-[#E5484D]/90 text-white"
              }`}
              aria-label={camOn ? "Stop video" : "Start video"}
            >
              {camOn && !camError ? <Video size={20} /> : <VideoOff size={20} />}
            </button>
          </div>
        </div>

        {/* Right: Meeting info & Join form */}
        <div className="flex flex-col justify-center">
          <h1 className="text-[24px] font-semibold text-[#232333] leading-snug">
            {meeting.title}
          </h1>
          <p className="text-sm text-[#6E6E85] mt-1 mb-6">
            Meeting ID: {formatMeetingId(meeting.meeting_code)}
          </p>

          <div className="space-y-2 mb-6">
            <Label htmlFor="nameInput" className="text-base font-medium text-[#232333]">
              Your name
            </Label>
            <Input
              id="nameInput"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              placeholder="Enter your name"
              className="h-12 rounded-xl border border-[#CFCFDC] px-4 text-base focus-visible:ring-2 focus-visible:ring-[#0B5CFF] bg-white shadow-none"
            />
            {/* Quick test name selector */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-xs text-[#6E6E85]">Quick presets:</span>
              <button
                type="button"
                onClick={() => setName("Alex Johnson (Host)")}
                className="text-xs px-2 py-0.5 rounded-md bg-[#EDEDF5] hover:bg-[#E4E4ED] text-[#232333] transition-colors cursor-pointer"
              >
                Host
              </button>
              <button
                type="button"
                onClick={() => setName("Sarah Connor (Guest)")}
                className="text-xs px-2 py-0.5 rounded-md bg-[#EDEDF5] hover:bg-[#E4E4ED] text-[#232333] transition-colors cursor-pointer"
              >
                Guest 1
              </button>
              <button
                type="button"
                onClick={() => setName("Guest Participant 2")}
                className="text-xs px-2 py-0.5 rounded-md bg-[#EDEDF5] hover:bg-[#E4E4ED] text-[#232333] transition-colors cursor-pointer"
              >
                Guest 2
              </button>
            </div>
            <p className="text-[11px] text-[#6E6E85] leading-tight">
              Tip: To test with 2 accounts, open the invite link in an Incognito window or another tab with a different name.
            </p>
          </div>

          <Button
            onClick={handleJoin}
            disabled={joining || !name.trim()}
            className="w-full h-12 rounded-xl bg-[#0B5CFF] hover:bg-[#0A4FD9] text-white font-semibold text-base cursor-pointer shadow-xs"
          >
            {joining ? (asHost ? "Starting..." : "Joining...") : (asHost ? "Start" : "Join")}
          </Button>
        </div>
      </div>
    </div>
  );
}
