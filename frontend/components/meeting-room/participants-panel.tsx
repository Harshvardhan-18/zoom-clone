"use client";

import { X, Mic, MicOff, Video, VideoOff, MoreHorizontal } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { type Participant, muteAll, removeParticipant, updateParticipant } from "@/lib/api";
import { getAvatarColor, getInitial, inviteLink } from "@/lib/utils";

interface ParticipantsPanelProps {
  open: boolean;
  onClose: () => void;
  code: string;
  participants: Participant[];
  selfId: number;
  isHost: boolean;
  hostParticipantId: number;
  onRefresh: () => void;
}

export default function ParticipantsPanel({
  open,
  onClose,
  code,
  participants,
  selfId,
  isHost,
  hostParticipantId,
  onRefresh,
}: ParticipantsPanelProps) {
  if (!open) return null;

  async function handleMuteAll() {
    try {
      await muteAll(code, hostParticipantId);
      onRefresh();
      toast.success("All participants muted");
    } catch (e: unknown) {
      toast.error((e as Error).message || "Failed to mute all");
    }
  }

  async function handleMuteOne(p: Participant) {
    try {
      await updateParticipant(p.id, { is_muted: true });
      onRefresh();
      toast.success(`${p.display_name} muted`);
    } catch (e: unknown) {
      toast.error((e as Error).message || "Failed to mute");
    }
  }

  async function handleRemove(p: Participant) {
    try {
      await removeParticipant(p.id, hostParticipantId);
      onRefresh();
      toast.success(`${p.display_name} removed`);
    } catch (e: unknown) {
      toast.error((e as Error).message || "Failed to remove");
    }
  }

  function handleInvite() {
    const link = inviteLink(code);
    navigator.clipboard.writeText(link);
    toast.success("Invite link copied to clipboard");
  }

  return (
    <div className="fixed inset-0 z-20 md:static md:w-[340px] md:my-2 md:mr-2 md:h-[calc(100%-16px)] bg-[#242424] rounded-xl flex flex-col shrink-0 overflow-hidden border border-white/5 select-none shadow-2xl">
      {/* Header: Participants (n) centered with X close button */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-white/5 shrink-0">
        <div className="w-7" />
        <h3 className="text-base font-medium text-white text-center flex-1">
          Participants ({participants.length})
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Close participants panel"
        >
          <X size={18} />
        </button>
      </div>

      {/* Participant List */}
      <ScrollArea className="flex-1 overflow-y-auto px-2 py-3">
        <div className="space-y-1">
          {participants.map((p) => {
            const isSelf = p.id === selfId;
            const isParticipantHost = p.role === "host";
            const avatarBg = getAvatarColor(p.display_name, isParticipantHost);
            const initial = getInitial(p.display_name);

            let suffix = "";
            if (isParticipantHost && isSelf) {
              suffix = " (Host, me)";
            } else if (isSelf) {
              suffix = " (Me)";
            } else if (isParticipantHost) {
              suffix = " (Host)";
            }

            return (
              <div
                key={p.id}
                className="flex items-center gap-3 px-3 py-2 hover:bg-white/5 rounded-lg transition-colors"
              >
                {/* 40px square-rounded avatar */}
                <div
                  style={{ backgroundColor: avatarBg }}
                  className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center text-white font-medium text-base select-none shadow-xs"
                >
                  {initial}
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] text-white truncate leading-tight">
                    {p.display_name}
                    {suffix}
                  </p>
                </div>

                {/* Audio / Video status */}
                <div className="flex items-center gap-2 shrink-0">
                  {p.is_muted ? (
                    <MicOff size={16} className="text-[#E5484D]" />
                  ) : (
                    <Mic size={16} className="text-white/40" />
                  )}
                  {p.is_video_on ? (
                    <Video size={16} className="text-white/40" />
                  ) : (
                    <VideoOff size={16} className="text-[#E5484D]" />
                  )}

                  {/* Host actions on other participants */}
                  {isHost && !isSelf && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="p-1 rounded text-white/50 hover:text-white hover:bg-white/10 cursor-pointer"
                          aria-label={`Options for ${p.display_name}`}
                        >
                          <MoreHorizontal size={16} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="bg-[#333333] border border-white/10 text-white rounded-xl p-1 shadow-2xl"
                      >
                        <DropdownMenuItem
                          onClick={() => handleMuteOne(p)}
                          className="px-3 py-1.5 text-sm text-white hover:bg-white/10 cursor-pointer rounded-lg focus:bg-white/10 focus:text-white"
                        >
                          Mute
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleRemove(p)}
                          className="px-3 py-1.5 text-sm text-[#E5484D] hover:bg-white/10 cursor-pointer rounded-lg focus:bg-white/10 focus:text-[#E5484D]"
                        >
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Footer: Pill buttons (rounded-full, bg #333, h-9, px-4, 14px) */}
      <div className="p-3 border-t border-white/5 flex items-center justify-between gap-3 shrink-0">
        <button
          type="button"
          onClick={handleInvite}
          className="rounded-full bg-[#333333] hover:bg-[#444444] text-white h-9 px-4 text-sm font-medium transition-colors cursor-pointer select-none flex-1 text-center"
        >
          Invite
        </button>

        {isHost && (
          <button
            type="button"
            onClick={handleMuteAll}
            className="rounded-full bg-[#333333] hover:bg-[#444444] text-white h-9 px-4 text-sm font-medium transition-colors cursor-pointer select-none flex-1 text-center"
          >
            Mute All
          </button>
        )}
      </div>
    </div>
  );
}
