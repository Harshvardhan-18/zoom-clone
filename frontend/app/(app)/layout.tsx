import TopBar from "@/components/top-bar";
import SideRail from "@/components/side-rail";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-screen flex flex-col bg-[#F5F5FA] overflow-hidden">
      {/* 56px top bar */}
      <TopBar />

      {/* Side rail + Main panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop-only 72px side rail */}
        <SideRail />

        {/* Main panel framed by lavender background */}
        <main className="flex-1 min-w-0 bg-white md:rounded-3xl m-0 md:mr-3 md:mb-3 p-4 md:p-8 overflow-y-auto shadow-xs">
          <div className="max-w-3xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
