"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Calendar as CalendarIcon, Plus } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { createMeeting } from "@/lib/api";
import { inviteLink } from "@/lib/utils";

const ORDERED_TIME_SLOTS = [
  "12:00", "12:15", "12:30", "12:45",
  "1:00", "1:15", "1:30", "1:45",
  "2:00", "2:15", "2:30", "2:45",
  "3:00", "3:15", "3:30", "3:45",
  "4:00", "4:15", "4:30", "4:45",
  "5:00", "5:15", "5:30", "5:45",
  "6:00", "6:15", "6:30", "6:45",
  "7:00", "7:15", "7:30", "7:45",
  "8:00", "8:15", "8:30", "8:45",
  "9:00", "9:15", "9:30", "9:45",
  "10:00", "10:15", "10:30", "10:45",
  "11:00", "11:15", "11:30", "11:45",
];

function getNextQuarterHour(): { date: Date; slot: string; ampm: "AM" | "PM" } {
  const d = new Date();
  const minutes = d.getMinutes();
  const remainder = minutes % 15;
  const addMinutes = 15 - remainder;
  d.setMinutes(minutes + addMinutes);
  d.setSeconds(0);
  d.setMilliseconds(0);

  let h = d.getHours();
  const ampm: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;

  const m = d.getMinutes().toString().padStart(2, "0");
  return {
    date: d,
    slot: `${h}:${m}`,
    ampm,
  };
}

function formatInputDate(d: Date): string {
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const dd = d.getDate().toString().padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

export default function SchedulePage() {
  const router = useRouter();

  const initialTime = useMemo(() => getNextQuarterHour(), []);

  const [topic, setTopic] = useState("My Meeting");
  const [showDescription, setShowDescription] = useState(false);
  const [description, setDescription] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date>(initialTime.date);
  const [selectedTime, setSelectedTime] = useState<string>(initialTime.slot);
  const [selectedAmPm, setSelectedAmPm] = useState<"AM" | "PM">(initialTime.ampm);
  const [durationHours, setDurationHours] = useState("0");
  const [durationMinutes, setDurationMinutes] = useState("30");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Timezone string
  const timeZoneDisplay = useMemo(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const offsetMinutes = -new Date().getTimezoneOffset();
      const sign = offsetMinutes >= 0 ? "+" : "-";
      const offH = Math.floor(Math.abs(offsetMinutes) / 60)
        .toString()
        .padStart(2, "0");
      const offM = (Math.abs(offsetMinutes) % 60).toString().padStart(2, "0");
      return `(GMT${sign}${offH}:${offM}) ${tz}`;
    } catch {
      return "Local Timezone";
    }
  }, []);

  async function handleSave() {
    if (!topic.trim()) {
      toast.error("Topic is required");
      return;
    }

    const totalMinutes =
      parseInt(durationHours, 10) * 60 + parseInt(durationMinutes, 10);
    if (totalMinutes <= 0) {
      toast.error("Duration must be greater than 0");
      return;
    }

    // Combine date + time + AM/PM
    const [hStr, mStr] = selectedTime.split(":");
    let h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    if (selectedAmPm === "PM" && h !== 12) h += 12;
    if (selectedAmPm === "AM" && h === 12) h = 0;

    const startDateTime = new Date(selectedDate);
    startDateTime.setHours(h, m, 0, 0);

    // Validate not in past (allow 1 min leeway)
    if (startDateTime.getTime() < Date.now() - 60000) {
      toast.error("Start time cannot be in the past");
      return;
    }

    setSaving(true);
    try {
      const meeting = await createMeeting({
        title: topic.trim(),
        description: showDescription && description.trim() ? description.trim() : undefined,
        start_time: startDateTime.toISOString(),
        duration_minutes: totalMinutes,
      });

      const link = inviteLink(meeting.meeting_code);
      toast.success("Meeting scheduled", {
        action: {
          label: "Copy invite",
          onClick: () => {
            navigator.clipboard.writeText(link);
            toast.success("Invite link copied!");
          },
        },
        duration: 6000,
      });

      router.push("/");
    } catch (e: unknown) {
      toast.error((e as Error).message || "Failed to schedule meeting");
      setSaving(false);
    }
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  return (
    <div className="max-w-3xl w-full py-2">
      {/* Back button */}
      <Link
        href="/"
        className="text-[#0B5CFF] inline-flex items-center gap-1 text-base font-medium hover:underline cursor-pointer"
      >
        <ChevronLeft size={18} />
        Back
      </Link>

      <h1 className="text-[28px] font-semibold text-[#232333] mt-6 mb-8 tracking-tight">
        Schedule Meeting
      </h1>

      {/* Form rows in grid-cols-[160px_1fr] */}
      <div className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-y-6 max-w-3xl">
        {/* 1. Topic */}
        <div className="flex items-start md:pt-3">
          <Label htmlFor="topic" className="text-base font-medium text-[#232333]">
            <span className="text-[#E5484D] mr-1">*</span>Topic
          </Label>
        </div>
        <div>
          <Input
            id="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="h-12 rounded-xl border border-[#CFCFDC] px-4 text-base focus-visible:ring-2 focus-visible:ring-[#0B5CFF] focus-visible:border-transparent bg-white shadow-none"
          />
          {!showDescription ? (
            <button
              type="button"
              onClick={() => setShowDescription(true)}
              className="text-[#0B5CFF] text-sm font-medium hover:underline mt-2.5 inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus size={14} /> Add Description
            </button>
          ) : (
            <div className="mt-3">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Meeting description (optional)"
                className="rounded-xl border border-[#CFCFDC] p-3 text-base min-h-[90px] focus-visible:ring-2 focus-visible:ring-[#0B5CFF] focus-visible:border-transparent bg-white shadow-none"
              />
            </div>
          )}
        </div>

        {/* 2. When */}
        <div className="flex items-center md:pt-3">
          <Label className="text-base font-medium text-[#232333]">When</Label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Date Picker */}
          <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="h-12 px-4 rounded-xl border border-[#CFCFDC] bg-white flex items-center justify-between gap-3 text-base text-[#232333] hover:border-[#6E6E85] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5CFF] min-w-[160px] cursor-pointer"
              >
                <span>{formatInputDate(selectedDate)}</span>
                <CalendarIcon size={18} className="text-[#6E6E85]" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-white border border-[#E4E4ED] shadow-lg rounded-xl" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => {
                  if (d) {
                    setSelectedDate(d);
                    setIsDatePickerOpen(false);
                  }
                }}
                disabled={(date) => date < todayStart}
              />
            </PopoverContent>
          </Popover>

          {/* Time Select */}
          <Select value={selectedTime} onValueChange={setSelectedTime}>
            <SelectTrigger className="h-12 w-28 rounded-xl border border-[#CFCFDC] bg-white text-base focus:ring-2 focus:ring-[#0B5CFF] shadow-none">
              <SelectValue placeholder="Time" />
            </SelectTrigger>
            <SelectContent className="max-h-60 bg-white border border-[#E4E4ED] shadow-lg rounded-xl">
              {ORDERED_TIME_SLOTS.map((slot) => (
                <SelectItem key={slot} value={slot} className="text-base cursor-pointer">
                  {slot}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* AM/PM Select */}
          <Select value={selectedAmPm} onValueChange={(v) => setSelectedAmPm(v as "AM" | "PM")}>
            <SelectTrigger className="h-12 w-24 rounded-xl border border-[#CFCFDC] bg-white text-base focus:ring-2 focus:ring-[#0B5CFF] shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white border border-[#E4E4ED] shadow-lg rounded-xl">
              <SelectItem value="AM" className="text-base cursor-pointer">AM</SelectItem>
              <SelectItem value="PM" className="text-base cursor-pointer">PM</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* 3. Duration */}
        <div className="flex items-center md:pt-3">
          <Label className="text-base font-medium text-[#232333]">Duration</Label>
        </div>
        <div className="flex items-center gap-3">
          <Select value={durationHours} onValueChange={setDurationHours}>
            <SelectTrigger className="h-12 w-24 rounded-xl border border-[#CFCFDC] bg-white text-base focus:ring-2 focus:ring-[#0B5CFF] shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white border border-[#E4E4ED] shadow-lg rounded-xl">
              <SelectItem value="0" className="text-base cursor-pointer">0</SelectItem>
              <SelectItem value="1" className="text-base cursor-pointer">1</SelectItem>
              <SelectItem value="2" className="text-base cursor-pointer">2</SelectItem>
              <SelectItem value="3" className="text-base cursor-pointer">3</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-base text-[#232333] font-normal mr-2">hr</span>

          <Select value={durationMinutes} onValueChange={setDurationMinutes}>
            <SelectTrigger className="h-12 w-24 rounded-xl border border-[#CFCFDC] bg-white text-base focus:ring-2 focus:ring-[#0B5CFF] shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-white border border-[#E4E4ED] shadow-lg rounded-xl">
              <SelectItem value="0" className="text-base cursor-pointer">0</SelectItem>
              <SelectItem value="15" className="text-base cursor-pointer">15</SelectItem>
              <SelectItem value="30" className="text-base cursor-pointer">30</SelectItem>
              <SelectItem value="45" className="text-base cursor-pointer">45</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-base text-[#232333] font-normal">min</span>
        </div>

        {/* 4. Time Zone */}
        <div className="flex items-center md:pt-3">
          <Label className="text-base font-medium text-[#232333]">Time Zone</Label>
        </div>
        <div>
          <Select disabled defaultValue="tz">
            <SelectTrigger className="h-12 max-w-md w-full rounded-xl border border-[#CFCFDC] bg-[#EDEDF5] text-base text-[#232333] opacity-80 cursor-not-allowed shadow-none">
              <SelectValue>{timeZoneDisplay}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tz">{timeZoneDisplay}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Empty left column for spacing bottom actions */}
        <div className="hidden md:block" />
        <div className="flex items-center gap-4 pt-4">
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="h-11 px-8 rounded-xl bg-[#0B5CFF] hover:bg-[#0A4FD9] text-white font-medium text-base cursor-pointer shadow-xs"
          >
            {saving ? "Saving..." : "Save"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/")}
            className="h-11 px-6 rounded-xl border border-[#E4E4ED] text-[#232333] hover:bg-[#F5F5FA] font-medium text-base cursor-pointer shadow-xs"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
