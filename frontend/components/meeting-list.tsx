"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, Trash2, Copy, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { type Meeting, deleteMeeting, joinMeeting } from "@/lib/api";
import { formatMeetingId, inviteLink, formatDate, formatTimeRange } from "@/lib/utils";

interface MeetingListProps {
  meetings: Meeting[];
  type: "upcoming" | "recent";
  loading?: boolean;
  onRefresh: () => void;
}

export default function MeetingList({
  meetings,
  type,
  loading = false,
  onRefresh,
}: MeetingListProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<number | null>(null);

  if (loading) {
    return (
      <div className="space-y-4 py-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex flex-col md:flex-row md:items-center justify-between gap-3 py-4 border-b border-[#E4E4ED] last:border-b-0"
          >
            <div className="md:w-[150px] space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-28" />
            </div>
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-20 rounded-lg" />
              <Skeleton className="h-9 w-28 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (meetings.length === 0) {
    return (
      <div className="my-2 bg-[#F5F5FA] rounded-xl p-6 text-center">
        <p className="font-bold text-lg text-[#232333]">
          {type === "upcoming" ? "No Upcoming Meetings" : "No Recent Meetings"}
        </p>
      </div>
    );
  }

  async function handleDelete(meeting: Meeting) {
    setDeletingId(meeting.id);
    try {
      let storedId = Number(
        sessionStorage.getItem(`participant:${meeting.meeting_code}`) ?? "0"
      );
      if (!storedId) {
        // Automatically join as host to acquire valid participant auth for deletion
        const part = await joinMeeting(meeting.meeting_code, {
          display_name: "Host",
          as_host: true,
        });
        storedId = part.id;
        sessionStorage.setItem(`participant:${meeting.meeting_code}`, String(part.id));
      }
      await deleteMeeting(meeting.meeting_code, storedId);
      toast.success("Meeting deleted");
      onRefresh();
    } catch (e: unknown) {
      toast.error((e as Error).message || "Failed to delete meeting");
    } finally {
      setDeletingId(null);
    }
  }

  function handleCopyInvite(meeting: Meeting) {
    const link = inviteLink(meeting.meeting_code);
    navigator.clipboard.writeText(link);
    toast.success("Invite link copied to clipboard");
  }

  function handleStart(meeting: Meeting) {
    router.push(`/j/${meeting.meeting_code}?host=1`);
  }

  return (
    <div className="divide-y divide-[#E4E4ED]">
      {meetings.map((m) => {
        const dateIso = m.start_time ?? m.started_at ?? m.created_at;
        const dateStr = formatDate(dateIso);
        const timeRangeStr = formatTimeRange(dateIso, m.duration_minutes ?? 30);

        return (
          <div
            key={m.id}
            className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4"
          >
            {/* Left column (fixed ~150px) */}
            <div className="md:w-[150px] shrink-0">
              <p className="text-[13px] text-[#6E6E85] font-normal leading-none mb-1">
                {dateStr || "Today"}
              </p>
              <p className="text-sm font-semibold text-[#232333] leading-tight">
                {timeRangeStr}
              </p>
            </div>

            {/* Middle column */}
            <div className="flex-1 min-w-0">
              <h4 className="text-base font-semibold text-[#232333] truncate">
                {m.title}
              </h4>
              <p className="text-sm text-[#6E6E85] mt-1 font-normal">
                Meeting ID: {formatMeetingId(m.meeting_code)}
              </p>
            </div>

            {/* Right column */}
            <div className="flex items-center gap-2 shrink-0 mt-1 md:mt-0">
              {type === "upcoming" ? (
                <>
                  <Button
                    onClick={() => handleStart(m)}
                    className="h-9 px-4 rounded-lg bg-[#0B5CFF] hover:bg-[#0A4FD9] text-white text-sm font-medium cursor-pointer shadow-xs"
                  >
                    Start
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleCopyInvite(m)}
                    className="h-9 px-3 rounded-lg border-[#E4E4ED] text-[#232333] hover:bg-[#F5F5FA] text-sm font-medium cursor-pointer shadow-xs"
                  >
                    <Copy size={14} className="mr-1.5 text-[#6E6E85]" />
                    Copy invitation
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 text-[#6E6E85] hover:text-[#232333] hover:bg-[#F5F5FA] rounded-lg cursor-pointer"
                        aria-label="More options"
                      >
                        <MoreVertical size={16} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-white border-[#E4E4ED] shadow-md rounded-xl p-1">
                      <DropdownMenuItem
                        disabled={deletingId === m.id}
                        onClick={() => handleDelete(m)}
                        className="text-[#E5484D] hover:text-[#E5484D] hover:bg-red-50 cursor-pointer rounded-lg px-3 py-2 text-sm font-medium"
                      >
                        <Trash2 size={14} className="mr-2" />
                        {deletingId === m.id ? "Deleting..." : "Delete"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-sm text-[#6E6E85]">
                    {/* Recent participants estimate or display */}
                    2 participants
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleStart(m)}
                    className="h-9 px-3 text-sm text-[#0B5CFF] hover:text-[#0A4FD9] hover:bg-blue-50 rounded-lg cursor-pointer font-medium"
                  >
                    <Play size={13} className="mr-1.5" />
                    Start again
                  </Button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
