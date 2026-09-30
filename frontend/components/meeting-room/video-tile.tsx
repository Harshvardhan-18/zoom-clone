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
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

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
            !hasVideo && "hidden"
          )}
        />
      )}

      {/* Center: Square initial avatar when video is off */}
      {!hasVideo && (
        <div
          style={{ backgroundColor: avatarBg }}
          className="w-28 h-28 sm:w-36 sm:h-36 rounded-none text-white flex items-center justify-center text-5xl sm:text-6xl md:text-7xl font-medium select-none shadow-sm"
        >
          {initial}
        </div>
      )}

      {/* Name tag at bottom-left */}
      <div className="absolute bottom-2 left-2 bg-black/50 rounded px-2 py-1 flex items-center gap-1.5 z-10">
        {participant.is_muted && (
          <MicOff size={14} className="text-[#E5484D] shrink-0" />
        )}
        <span className="text-[15px] text-white font-normal leading-tight truncate max-w-[200px]">
          {participant.display_name}
        </span>
      </div>
    </div>
  );
}
