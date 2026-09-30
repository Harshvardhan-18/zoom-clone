"use client";

import { useEffect, useState, Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getMeeting, type Meeting } from "@/lib/api";
import PreJoin from "@/components/prejoin";

function InvitePageContent() {
  const { code } = useParams<{ code: string }>();
  const searchParams = useSearchParams();
  const asHost = searchParams.get("host") === "1";
  const nameParam = searchParams.get("name") ?? "";

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!code) return;
    getMeeting(code)
      .then((m) => {
        setMeeting(m);
        setLoading(false);
      })
      .catch(() => {
        setError("Invalid meeting ID");
        setLoading(false);
      });
  }, [code]);

  return (
    <div className="min-h-screen bg-[#F5F5FA] flex flex-col">
      {/* Minimal top bar (wordmark only) */}
      <header className="h-[56px] bg-white border-b border-[#E4E4ED] px-6 flex items-center shrink-0">
        <Link href="/" className="flex items-center select-none">
          <span className="text-[#0B5CFF] font-bold text-[28px] tracking-tight leading-none">
            zoom
          </span>
        </Link>
      </header>

      {/* Content centered vertically */}
      <main className="flex-1 flex items-center justify-center p-4">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="h-10 w-10 rounded-full border-3 border-[#0B5CFF] border-t-transparent animate-spin" />
          </div>
        ) : error || !meeting ? (
          <div className="bg-white rounded-2xl border border-[#E4E4ED] shadow-sm p-8 max-w-md w-full text-center">
            <h2 className="text-2xl font-semibold text-[#232333] mb-2">
              Invalid meeting ID
            </h2>
            <p className="text-sm text-[#6E6E85] mb-6">
              This meeting does not exist or the link is invalid.
            </p>
            <Button
              asChild
              className="h-11 px-6 rounded-xl bg-[#0B5CFF] hover:bg-[#0A4FD9] text-white font-medium cursor-pointer"
            >
              <Link href="/">Back to Home</Link>
            </Button>
          </div>
        ) : meeting.status === "ended" ? (
          <div className="bg-white rounded-2xl border border-[#E4E4ED] shadow-sm p-8 max-w-md w-full text-center">
            <h2 className="text-2xl font-semibold text-[#232333] mb-2">
              This meeting has ended
            </h2>
            <p className="text-sm text-[#6E6E85] mb-6">
              The host has ended this meeting. You can return to the home screen.
            </p>
            <Button
              asChild
              className="h-11 px-6 rounded-xl bg-[#0B5CFF] hover:bg-[#0A4FD9] text-white font-medium cursor-pointer"
            >
              <Link href="/">Back to Home</Link>
            </Button>
          </div>
        ) : (
          <PreJoin meeting={meeting} defaultName={nameParam} asHost={asHost} />
        )}
      </main>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F5F5FA] flex items-center justify-center">
          <div className="h-10 w-10 rounded-full border-3 border-[#0B5CFF] border-t-transparent animate-spin" />
        </div>
      }
    >
      <InvitePageContent />
    </Suspense>
  );
}
