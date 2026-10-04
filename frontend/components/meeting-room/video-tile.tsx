"use client";

import { useEffect, useRef } from "react";
import { MicOff } from "lucide-react";
import type { Participant } from "@/lib/api";
import { getAvatarColor, getInitial, cn } from "@/lib/utils";

interface VideoTileProps {
  participant: Participant;
  isSelf: boolean;
  stream?: MediaStream | null;
}

export default function VideoTile({ participant, isSelf, stream }: VideoTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const isHost = participant.role === "host";
  const avatarBg = getAvatarColor(participant.display_name, isHost);
  const initial = getInitial(participant.display_name);

  // Attach stream to video element whenever stream changes
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isSelf;
      if (stream) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    }
  }, [stream, isSelf]);

  const hasVideo = !!stream && participant.is_video_on;

  return (
    <div className="relative rounded-sm overflow-hidden bg-[#202020] w-full h-full flex items-center justify-center select-none">
      {/* Video element: in DOM if stream exists so remote audio continues playing even if video is off */}
      {stream && (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isSelf} // Self must be muted to avoid feedback echo
          className={cn(
            "w-full h-full object-cover",
            isSelf && "transform -scale-x-100",
            !hasVideo && "opacity-0 absolute inset-0 pointer-events-none"
          )}
        />
      )}

      {/* Center: Square initial avatar when video is off */}
      {!hasVideo && (
        <div
          style={{ backgroundColor: avatarBg }}
          className="w-16 h-16 sm:w-24 sm:h-24 md:w-32 md:h-32 rounded-lg text-white flex items-center justify-center text-3xl sm:text-4xl md:text-6xl font-medium select-none shadow-sm"
        >
          {initial}
        </div>
      )}

      {/* Name tag at bottom-left */}
      <div className="absolute bottom-1.5 left-1.5 sm:bottom-2 sm:left-2 bg-black/60 rounded px-1.5 py-0.5 sm:px-2 sm:py-1 flex items-center gap-1 z-10 max-w-[80%]">
        {participant.is_muted && (
          <MicOff size={11} className="text-[#E5484D] shrink-0" />
        )}
        <span className="text-[11px] sm:text-[13px] text-white font-normal leading-tight truncate">
          {participant.display_name}
        </span>
      </div>
    </div>
  );
}
