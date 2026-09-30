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
  return (
    <div className="h-[72px] bg-[#0F0F0F] flex items-center justify-between px-4 sm:px-8 shrink-0 border-t border-white/5 select-none">
      {/* Left group: Audio and Video controls */}
      <div className="flex items-center gap-1 sm:gap-2">
        <button
          onClick={onToggleMic}
          className="flex flex-col items-center justify-center rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 hover:bg-[#2A2A2A] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0B5CFF]"
          title={micOn ? "Mute" : "Unmute"}
          aria-label={micOn ? "Mute" : "Unmute"}
        >
          {micOn ? (
            <Mic size={24} className="text-white" />
          ) : (
            <MicOff size={24} className="text-[#E5484D]" />
          )}
          <span className="text-[12px] sm:text-[13px] text-white mt-1 leading-none hidden sm:block">
            {micOn ? "Mute" : "Unmute"}
          </span>
        </button>

        <button
          onClick={onToggleCam}
          className="flex flex-col items-center justify-center rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 hover:bg-[#2A2A2A] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0B5CFF]"
          title={camOn ? "Stop Video" : "Start Video"}
          aria-label={camOn ? "Stop Video" : "Start Video"}
        >
          {camOn ? (
            <Video size={24} className="text-white" />
          ) : (
            <VideoOff size={24} className="text-[#E5484D]" />
          )}
          <span className="text-[12px] sm:text-[13px] text-white mt-1 leading-none hidden sm:block">
            {camOn ? "Stop Video" : "Start Video"}
          </span>
        </button>
      </div>

      {/* Center group: Participants */}
      <div className="flex items-center justify-center">
        <button
          onClick={onTogglePanel}
          className={`flex flex-col items-center justify-center rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0B5CFF] ${
            panelOpen ? "bg-[#2A2A2A]" : "hover:bg-[#2A2A2A]"
          }`}
          title="Participants"
          aria-label="Participants"
        >
          <div className="relative">
            <Users size={24} className="text-white" />
            <span className="absolute -top-1.5 -right-2.5 text-[11px] font-semibold text-white leading-none">
              {participantCount}
            </span>
          </div>
          <span className="text-[12px] sm:text-[13px] text-white mt-1 leading-none hidden sm:block">
            Participants
          </span>
        </button>
      </div>

      {/* Right group: End (Host) or Leave (Participant) */}
      <div className="flex items-center">
        {isHost ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex flex-col items-center justify-center rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 hover:bg-[#2A2A2A] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0B5CFF]"
                title="End Meeting"
                aria-label="End Meeting"
              >
                <OctagonX size={24} className="text-[#E5484D]" />
                <span className="text-[12px] sm:text-[13px] text-[#E5484D] font-medium mt-1 leading-none hidden sm:block">
                  End
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="top"
              align="end"
              className="bg-[#242424] border border-white/10 text-white rounded-xl p-1.5 mb-2 shadow-2xl min-w-[180px]"
            >
              <DropdownMenuItem
                onClick={onEnd}
                className="text-[#E5484D] hover:text-[#E5484D] hover:bg-white/10 cursor-pointer rounded-lg px-3 py-2 text-sm font-medium focus:bg-white/10 focus:text-[#E5484D]"
              >
                End meeting for all
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onLeave}
                className="text-white hover:bg-white/10 cursor-pointer rounded-lg px-3 py-2 text-sm font-medium focus:bg-white/10 focus:text-white"
              >
                Leave meeting
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <button
            onClick={onLeave}
            className="flex flex-col items-center justify-center rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 hover:bg-[#2A2A2A] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#0B5CFF]"
            title="Leave Meeting"
            aria-label="Leave Meeting"
          >
            <OctagonX size={24} className="text-[#E5484D]" />
            <span className="text-[12px] sm:text-[13px] text-[#E5484D] font-medium mt-1 leading-none hidden sm:block">
              Leave
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
