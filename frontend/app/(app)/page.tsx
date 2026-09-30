"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import Clock from "@/components/clock";
import ActionButtons from "@/components/action-buttons";
import MeetingList from "@/components/meeting-list";
import { getMe, getUpcoming, getRecent, type Meeting, type User } from "@/lib/api";
import { getStoredUser, USER_CHANGED_EVENT } from "@/lib/user";

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [activeName, setActiveName] = useState<string>("");
  const [upcoming, setUpcoming] = useState<Meeting[]>([]);
  const [recent, setRecent] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const stored = getStoredUser();
    if (stored?.name) {
      setActiveName(stored.name);
    }
    try {
      const [u, up, re] = await Promise.all([
        getMe().catch(() => null),
        getUpcoming().catch(() => []),
        getRecent().catch(() => []),
      ]);
      if (u) {
        setUser(u);
        if (!stored?.name) {
          setActiveName(u.name);
        }
      }
      setUpcoming(up || []);
      setRecent(re || []);
    } catch {
      toast.error("Failed to load meetings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    function handleUserChanged(e: Event) {
      const customEvent = e as CustomEvent<{ name: string; email?: string }>;
      if (customEvent.detail?.name) {
        setActiveName(customEvent.detail.name);
      }
    }

    window.addEventListener(USER_CHANGED_EVENT, handleUserChanged);
    return () => {
      window.removeEventListener(USER_CHANGED_EVENT, handleUserChanged);
    };
  }, [fetchData]);

  const currentDisplayName = activeName || user?.name || "Host";

  return (
    <div className="flex flex-col items-center w-full py-4 sm:py-6">
      {/* 1. Centered Clock */}
      <Clock />

      {/* 2. Action buttons (New meeting, Join, Schedule) */}
      <div className="mt-6 md:mt-8">
        <ActionButtons userName={currentDisplayName} />
      </div>

      {/* 3. Meetings Card */}
      <div
        id="meetings"
        className="w-full mt-10 bg-white border border-[#E4E4ED] rounded-2xl p-6 shadow-xs"
      >
        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList className="w-full justify-start border-b border-[#E4E4ED] bg-transparent p-0 h-auto gap-8 rounded-none">
            <TabsTrigger
              value="upcoming"
              className="border-b-2 border-transparent data-[state=active]:border-[#0B5CFF] data-[state=active]:text-[#232333] text-[#6E6E85] hover:text-[#232333] bg-transparent data-[state=active]:bg-transparent shadow-none data-[state=active]:shadow-none rounded-none px-1 pb-3 text-base font-semibold cursor-pointer transition-none"
            >
              Upcoming
            </TabsTrigger>
            <TabsTrigger
              value="recent"
              className="border-b-2 border-transparent data-[state=active]:border-[#0B5CFF] data-[state=active]:text-[#232333] text-[#6E6E85] hover:text-[#232333] bg-transparent data-[state=active]:bg-transparent shadow-none data-[state=active]:shadow-none rounded-none px-1 pb-3 text-base font-semibold cursor-pointer transition-none"
            >
              Recent
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming" className="mt-2 focus-visible:outline-none">
            <MeetingList
              meetings={upcoming}
              type="upcoming"
              loading={loading}
              onRefresh={fetchData}
            />
          </TabsContent>

          <TabsContent value="recent" className="mt-2 focus-visible:outline-none">
            <MeetingList
              meetings={recent}
              type="recent"
              loading={loading}
              onRefresh={fetchData}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
