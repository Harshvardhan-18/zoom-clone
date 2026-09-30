"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Video, Plus } from "lucide-react";
import { toast } from "sonner";
import { createMeeting, joinMeeting } from "@/lib/api";
import { inviteLink, formatMeetingId } from "@/lib/utils";

interface ActionButtonsProps {
  userName?: string;
}

export default function ActionButtons({ userName = "Host" }: ActionButtonsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Today's day of month for Schedule icon (e.g. 19 or 30)
  const todayDay = new Date().getDate();

  async function handleNewMeeting() {
    if (loading) return;
    setLoading(true);
    try {
      const meeting = await createMeeting({});
      const participant = await joinMeeting(meeting.meeting_code, {
        display_name: userName || "Host",
        as_host: true,
      });
      sessionStorage.setItem(`participant:${meeting.meeting_code}`, String(participant.id));

      const link = inviteLink(meeting.meeting_code);
      toast.success(`Meeting created! ID: ${formatMeetingId(meeting.meeting_code)}`, {
        action: {
          label: "Copy invite",
          onClick: () => {
            navigator.clipboard.writeText(link);
            toast.success("Invite link copied!");
          },
        },
        duration: 6000,
      });

      router.push(`/meeting/${meeting.meeting_code}`);
    } catch (e: unknown) {
      toast.error((e as Error).message || "Failed to create meeting");
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center gap-6 sm:gap-8 md:gap-12 select-none py-2">
      {/* 1. New meeting */}
      <div className="flex flex-col items-center">
        <button
          onClick={handleNewMeeting}
          disabled={loading}
          className="w-[72px] h-[72px] md:w-[88px] md:h-[88px] rounded-[22px] md:rounded-[28px] bg-[#EE7A3B] text-white flex items-center justify-center shadow-xs transition-all duration-150 hover:brightness-95 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5CFF] focus-visible:ring-offset-2 cursor-pointer disabled:opacity-70"
          aria-label="New meeting"
        >
          <Video size={36} className="md:w-10 md:h-10 text-white" strokeWidth={2.2} />
        </button>
        <span className="text-sm md:text-base text-[#6E6E85] font-medium text-center mt-2.5">
          New meeting
        </span>
      </div>

      {/* 2. Join */}
      <div className="flex flex-col items-center">
        <button
          onClick={() => router.push("/join")}
          className="w-[72px] h-[72px] md:w-[88px] md:h-[88px] rounded-[22px] md:rounded-[28px] bg-[#2D6BE4] text-white flex items-center justify-center shadow-xs transition-all duration-150 hover:brightness-95 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5CFF] focus-visible:ring-offset-2 cursor-pointer"
          aria-label="Join meeting"
        >
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-white flex items-center justify-center shadow-xs">
            <Plus size={22} className="md:w-6 md:h-6 text-[#2D6BE4] stroke-[3.5]" />
          </div>
        </button>
        <span className="text-sm md:text-base text-[#6E6E85] font-medium text-center mt-2.5">
          Join
        </span>
      </div>

      {/* 3. Schedule */}
      <div className="flex flex-col items-center">
        <button
          onClick={() => router.push("/schedule")}
          className="w-[72px] h-[72px] md:w-[88px] md:h-[88px] rounded-[22px] md:rounded-[28px] bg-[#2D6BE4] text-white flex items-center justify-center shadow-xs transition-all duration-150 hover:brightness-95 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5CFF] focus-visible:ring-offset-2 cursor-pointer"
          aria-label="Schedule meeting"
        >
          <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-white flex flex-col items-center justify-center shadow-xs pt-0.5">
            <div className="flex gap-1.5 mb-0.5">
              <span className="w-1 h-1 rounded-full bg-[#2D6BE4]" />
              <span className="w-1 h-1 rounded-full bg-[#2D6BE4]" />
            </div>
            <span className="text-[13px] md:text-[15px] font-bold text-[#2D6BE4] leading-none">
              {todayDay}
            </span>
          </div>
        </button>
        <span className="text-sm md:text-base text-[#6E6E85] font-medium text-center mt-2.5">
          Schedule
        </span>
      </div>
    </div>
  );
}
