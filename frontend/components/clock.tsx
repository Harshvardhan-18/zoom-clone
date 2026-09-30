"use client";

import { useEffect, useState } from "react";

export default function Clock() {
  const [mounted, setMounted] = useState(false);
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    setMounted(true);
    setNow(new Date());

    const timer = setInterval(() => {
      setNow(new Date());
    }, 15000);

    return () => clearInterval(timer);
  }, []);

  if (!mounted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[96px] py-2">
        <div className="h-12 w-48 bg-[#EDEDF5] rounded-xl animate-pulse" />
        <div className="h-6 w-64 bg-[#EDEDF5] rounded-lg animate-pulse mt-2" />
      </div>
    );
  }

  const timeString = now.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });

  const dateString = now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="flex flex-col items-center justify-center select-none py-2">
      <h2 className="text-[44px] md:text-[60px] font-semibold text-[#232333] tracking-tight text-center leading-none">
        {timeString}
      </h2>
      <p className="text-base md:text-[20px] text-[#6E6E85] font-normal text-center mt-2">
        {dateString}
      </p>
    </div>
  );
}
