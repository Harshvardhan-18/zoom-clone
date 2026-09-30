"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { getMeeting } from "@/lib/api";
import { normalizeMeetingCode } from "@/lib/utils";

export default function JoinPage() {
  const router = useRouter();
  const [inputVal, setInputVal] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const isEmpty = !inputVal.trim();

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (isEmpty || loading) return;

    const code = normalizeMeetingCode(inputVal);
    if (!code || code.length < 9) {
      setError("Invalid meeting ID");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const meeting = await getMeeting(code);
      if (meeting.status === "ended") {
        setError("This meeting has ended");
        return;
      }
      router.push(`/j/${code}`);
    } catch {
      setError("Invalid meeting ID");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto pt-16 sm:pt-20 px-2 flex flex-col items-center w-full">
      <h1 className="text-[32px] font-semibold text-[#232333] text-center tracking-tight">
        Join Meeting
      </h1>

      <form onSubmit={handleSubmit} className="w-full mt-10">
        <div>
          <Label
            htmlFor="meetingId"
            className="text-base font-medium text-[#232333] mb-2 block"
          >
            Meeting ID or invite link
          </Label>
          <Input
            id="meetingId"
            value={inputVal}
            onChange={(e) => {
              setInputVal(e.target.value);
              if (error) setError("");
            }}
            placeholder="Enter Meeting ID or invite link"
            className="h-12 rounded-xl border border-[#CFCFDC] px-4 text-base placeholder:text-[#6E6E85] focus-visible:ring-2 focus-visible:ring-[#0B5CFF] focus-visible:border-transparent bg-white shadow-none"
            autoFocus
          />
          {error && (
            <p className="text-[#E5484D] text-sm mt-2 font-normal">{error}</p>
          )}
        </div>

        <Button
          type="submit"
          disabled={isEmpty || loading}
          className={`w-full h-12 rounded-xl mt-6 text-base font-semibold transition-colors ${
            isEmpty || loading
              ? "bg-[#EDEDF5] text-[#A0A0B5] hover:bg-[#EDEDF5] cursor-not-allowed shadow-none"
              : "bg-[#0B5CFF] hover:bg-[#0A4FD9] text-white cursor-pointer shadow-xs"
          }`}
        >
          {loading ? "Joining..." : "Join"}
        </Button>
      </form>
    </div>
  );
}
