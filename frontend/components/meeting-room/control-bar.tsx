"use client";

import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Users,
  OctagonX,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ControlBarProps {
  micOn: boolean;
  camOn: boolean;
  participantCount: number;
  isHost: boolean;
  panelOpen: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onTogglePanel: () => void;
  onLeave: () => void;
  onEnd: () => void;
}

export default function ControlBar({
  micOn,
  camOn,
  participantCount,
  isHost,
  panelOpen,
  onToggleMic,
  onToggleCam,
  onTogglePanel,
  onLeave,
  onEnd,
}: ControlBarProps) {
  const btnBase =
    "flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 sm:px-4 sm:py-2.5 hover:bg-white/10 active:bg-white/15 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5CFF] min-w-[52px] sm:min-w-[64px]";
  const labelClass = "text-[11px] sm:text-[12px] text-white/80 leading-none font-medium";

  return (
    <div className="h-16 sm:h-[72px] bg-[#0F0F0F] flex items-center justify-around px-2 sm:px-6 shrink-0 border-t border-white/5 select-none safe-area-bottom">
      {/* Mic */}
      <button
        onClick={onToggleMic}
        className={btnBase}
        title={micOn ? "Mute" : "Unmute"}
        aria-label={micOn ? "Mute" : "Unmute"}
      >
        {micOn ? (
          <Mic size={22} className="text-white" />
        ) : (
          <div className="bg-[#E5484D] rounded-full p-1">
            <MicOff size={16} className="text-white" />
          </div>
        )}
        <span className={labelClass}>{micOn ? "Mute" : "Unmute"}</span>
      </button>

      {/* Camera */}
      <button
        onClick={onToggleCam}
        className={btnBase}
        title={camOn ? "Stop Video" : "Start Video"}
        aria-label={camOn ? "Stop Video" : "Start Video"}
      >
        {camOn ? (
          <Video size={22} className="text-white" />
        ) : (
          <div className="bg-[#E5484D] rounded-full p-1">
            <VideoOff size={16} className="text-white" />
          </div>
        )}
        <span className={labelClass}>{camOn ? "Video" : "No Video"}</span>
      </button>

      {/* Participants */}
      <button
        onClick={onTogglePanel}
        className={`${btnBase} ${panelOpen ? "bg-white/10" : ""}`}
        title="Participants"
        aria-label="Participants"
      >
        <div className="relative">
          <Users size={22} className="text-white" />
          <span className="absolute -top-2 -right-3 text-[11px] font-bold text-white bg-[#0B5CFF] rounded-full min-w-[16px] h-[16px] flex items-center justify-center px-1 leading-none">
            {participantCount}
          </span>
        </div>
        <span className={labelClass}>People</span>
      </button>

      {/* Leave / End */}
      {isHost ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={`${btnBase} hover:bg-[#E5484D]/20`}
              title="End Meeting"
              aria-label="End Meeting"
            >
              <OctagonX size={22} className="text-[#E5484D]" />
              <span className="text-[11px] sm:text-[12px] text-[#E5484D] font-medium leading-none">
                End
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="end"
            className="bg-[#242424] border border-white/10 text-white rounded-xl p-1.5 mb-2 shadow-2xl min-w-[190px]"
          >
            <DropdownMenuItem
              onClick={onEnd}
              className="text-[#E5484D] hover:text-[#E5484D] hover:bg-white/10 cursor-pointer rounded-lg px-3 py-2.5 text-sm font-medium focus:bg-white/10 focus:text-[#E5484D]"
            >
              End meeting for all
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onLeave}
              className="text-white hover:bg-white/10 cursor-pointer rounded-lg px-3 py-2.5 text-sm font-medium focus:bg-white/10 focus:text-white"
            >
              Leave meeting
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <button
          onClick={onLeave}
          className={`${btnBase} hover:bg-[#E5484D]/20`}
          title="Leave Meeting"
          aria-label="Leave Meeting"
        >
          <OctagonX size={22} className="text-[#E5484D]" />
          <span className="text-[11px] sm:text-[12px] text-[#E5484D] font-medium leading-none">
            Leave
          </span>
        </button>
      )}
    </div>
  );
}
