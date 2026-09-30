"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Home, Calendar, Settings } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function SideRail() {
  const pathname = usePathname();
  const router = useRouter();

  const isHome = pathname === "/";

  function handleMeetingsClick() {
    if (pathname === "/") {
      const el = document.getElementById("meetings");
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      router.push("/#meetings");
    }
  }

  return (
    <aside className="hidden md:flex flex-col items-center w-[72px] shrink-0 py-3 select-none bg-[#F5F5FA]">
      <div className="flex flex-col items-center gap-4 w-full">
        {/* Home */}
        <Link
          href="/"
          className={cn(
            "flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all cursor-pointer",
            isHome
              ? "bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] text-[#232333]"
              : "text-[#6E6E85] hover:text-[#232333] hover:bg-white/50"
          )}
          aria-label="Home"
        >
          <Home size={24} strokeWidth={isHome ? 2.25 : 1.75} />
          <span className="text-[12px] font-medium mt-1 leading-none">Home</span>
        </Link>

        {/* Meetings */}
        <button
          onClick={handleMeetingsClick}
          className="flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all cursor-pointer text-[#6E6E85] hover:text-[#232333] hover:bg-white/50"
          aria-label="Meetings"
        >
          <Calendar size={24} strokeWidth={1.75} />
          <span className="text-[12px] font-medium mt-1 leading-none">Meetings</span>
        </button>
      </div>

      {/* Settings pinned to bottom */}
      <div className="mt-auto flex flex-col items-center w-full">
        <button
          onClick={() => toast("Not available in demo")}
          className="flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all cursor-pointer text-[#6E6E85] hover:text-[#232333] hover:bg-white/50"
          aria-label="Settings"
        >
          <Settings size={24} strokeWidth={1.75} />
          <span className="text-[12px] font-medium mt-1 leading-none">Settings</span>
        </button>
      </div>
    </aside>
  );
}
