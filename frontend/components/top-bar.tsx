"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { UserPen, Users, Check } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { getMe, updateMe, type User } from "@/lib/api";
import { getInitial, getAvatarColor } from "@/lib/utils";
import { getStoredUser, setStoredUser, USER_CHANGED_EVENT } from "@/lib/user";

export default function TopBar() {
  const [user, setUser] = useState<User | null>(null);
  const [localName, setLocalName] = useState<string>("");
  const [localEmail, setLocalEmail] = useState<string>("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [tabOnly, setTabOnly] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadIdentity = useCallback(async () => {
    const stored = getStoredUser();
    if (stored?.name) {
      setLocalName(stored.name);
      if (stored.email) setLocalEmail(stored.email);
    }

    try {
      const u = await getMe();
      setUser(u);
      if (!stored?.name) {
        setLocalName(u.name);
        setLocalEmail(u.email);
      }
    } catch {
      // Backend not reachable or error
    }
  }, []);

  useEffect(() => {
    loadIdentity();

    function handleUserChanged(e: Event) {
      const customEvent = e as CustomEvent<{ name: string; email?: string }>;
      if (customEvent.detail?.name) {
        setLocalName(customEvent.detail.name);
        if (customEvent.detail.email) setLocalEmail(customEvent.detail.email);
      }
    }

    window.addEventListener(USER_CHANGED_EVENT, handleUserChanged);
    return () => {
      window.removeEventListener(USER_CHANGED_EVENT, handleUserChanged);
    };
  }, [loadIdentity]);

  const activeName = localName || user?.name || "Alex Johnson";
  const activeEmail = localEmail || user?.email || "alex@example.com";
  const initial = getInitial(activeName);
  const avatarBg = getAvatarColor(activeName, activeName.toLowerCase().includes("host") || activeName === (user?.name ?? "Alex Johnson"));

  function openChangeDialog() {
    setFormName(activeName);
    setFormEmail(activeEmail);
    setTabOnly(true);
    setDialogOpen(true);
  }

  async function handleSaveName() {
    if (!formName.trim()) {
      toast.error("Name cannot be empty");
      return;
    }

    setSaving(true);
    try {
      const trimmedName = formName.trim();
      const trimmedEmail = formEmail.trim();

      // Store locally (with tab isolation if tabOnly is checked)
      setStoredUser(trimmedName, trimmedEmail, tabOnly);
      setLocalName(trimmedName);
      setLocalEmail(trimmedEmail);

      // If user wants this to be global, also update backend
      if (!tabOnly) {
        await updateMe({ name: trimmedName, email: trimmedEmail }).catch(() => {});
      }

      toast.success(`Identity updated to: ${trimmedName}`);
      setDialogOpen(false);
    } catch (e: unknown) {
      toast.error((e as Error).message || "Failed to update name");
    } finally {
      setSaving(false);
    }
  }

  function handleQuickSwitch(name: string, email: string) {
    setStoredUser(name, email, true);
    setLocalName(name);
    setLocalEmail(email);
    toast.success(`Switched active tab to: ${name}`);
  }

  return (
    <>
      <header className="h-[56px] bg-white border-b border-[#E4E4ED] px-6 flex items-center justify-between shrink-0 z-10 select-none">
        {/* Left: Zoom Workplace wordmark */}
        <Link href="/" className="flex items-center select-none group">
          <span className="text-[#0B5CFF] font-bold text-[28px] tracking-tight leading-none">
            zoom
          </span>
          <div className="w-[1px] h-6 bg-[#E4E4ED] mx-3" />
          <span className="text-[#232333] text-[20px] font-medium leading-none">
            Workplace
          </span>
        </Link>

        {/* Right: Square-rounded avatar opening dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              style={{ backgroundColor: avatarBg }}
              className="w-9 h-9 rounded-lg text-white font-medium text-base flex items-center justify-center cursor-pointer transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B5CFF] focus-visible:ring-offset-2 select-none shadow-xs"
              aria-label="User menu"
              title={`Logged in as ${activeName}`}
            >
              {initial}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 bg-white border-[#E4E4ED] shadow-xl rounded-xl p-1.5">
            <DropdownMenuLabel className="px-3 py-2">
              <div className="flex items-center gap-2.5">
                <div
                  style={{ backgroundColor: avatarBg }}
                  className="w-8 h-8 rounded-lg text-white font-medium text-sm flex items-center justify-center shrink-0"
                >
                  {initial}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#232333] truncate leading-tight">
                    {activeName}
                  </p>
                  <p className="text-xs text-[#6E6E85] font-normal truncate mt-0.5">
                    {activeEmail}
                  </p>
                </div>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator className="bg-[#E4E4ED] my-1" />

            {/* Change Name action */}
            <DropdownMenuItem
              className="px-3 py-2 text-sm text-[#0B5CFF] font-medium cursor-pointer rounded-lg hover:bg-blue-50 focus:bg-blue-50 flex items-center gap-2"
              onClick={openChangeDialog}
            >
              <UserPen size={15} />
              Change Name / Switch Account
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-[#E4E4ED] my-1" />

            {/* Quick 1-click test presets */}
            <div className="px-3 py-1 text-[11px] font-semibold text-[#6E6E85] uppercase tracking-wider">
              Quick Test Switch
            </div>
            <DropdownMenuItem
              className="px-3 py-1.5 text-xs text-[#232333] cursor-pointer rounded-lg hover:bg-[#F5F5FA] flex items-center justify-between"
              onClick={() => handleQuickSwitch("Alex Johnson (Host)", "alex@example.com")}
            >
              <span>Account 1: Host</span>
              {activeName.includes("Host") && <Check size={14} className="text-[#0B5CFF]" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="px-3 py-1.5 text-xs text-[#232333] cursor-pointer rounded-lg hover:bg-[#F5F5FA] flex items-center justify-between"
              onClick={() => handleQuickSwitch("Sarah Connor (Guest)", "sarah@example.com")}
            >
              <span>Account 2: Guest</span>
              {activeName.includes("Guest") && <Check size={14} className="text-[#0B5CFF]" />}
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-[#E4E4ED] my-1" />

            <DropdownMenuItem
              className="px-3 py-2 text-sm text-[#232333] cursor-pointer rounded-lg hover:bg-[#F5F5FA]"
              onClick={() => toast("Not available in demo")}
            >
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              className="px-3 py-2 text-sm text-[#232333] cursor-pointer rounded-lg hover:bg-[#F5F5FA]"
              onClick={() => toast("Not available in demo")}
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Change Name Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md bg-white border-[#E4E4ED] rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-[#232333]">
              Change Name & Account
            </DialogTitle>
            <DialogDescription className="text-sm text-[#6E6E85]">
              Set your display name to test meetings across multiple tabs or browsers.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="changeNameInput" className="text-sm font-medium text-[#232333]">
                Display Name
              </Label>
              <Input
                id="changeNameInput"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Harshvardhan Yadav or Guest 2"
                className="h-11 rounded-xl border-[#CFCFDC] text-base"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="changeEmailInput" className="text-sm font-medium text-[#232333]">
                Email (optional)
              </Label>
              <Input
                id="changeEmailInput"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="e.g. user2@example.com"
                className="h-11 rounded-xl border-[#CFCFDC] text-base"
              />
            </div>

            {/* Quick preset chips */}
            <div>
              <Label className="text-xs font-medium text-[#6E6E85] block mb-1.5">
                Quick presets for testing
              </Label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFormName("Harshvardhan (Host)");
                    setFormEmail("harshvardhan@example.com");
                  }}
                  className="px-2.5 py-1 text-xs rounded-lg bg-[#EDEDF5] hover:bg-[#E4E4ED] text-[#232333] font-medium transition-colors"
                >
                  👤 Harshvardhan (Host)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormName("Sarah Connor (Guest)");
                    setFormEmail("sarah@example.com");
                  }}
                  className="px-2.5 py-1 text-xs rounded-lg bg-[#EDEDF5] hover:bg-[#E4E4ED] text-[#232333] font-medium transition-colors"
                >
                  👥 Sarah Connor (Guest)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormName("Alex Johnson");
                    setFormEmail("alex@example.com");
                  }}
                  className="px-2.5 py-1 text-xs rounded-lg bg-[#EDEDF5] hover:bg-[#E4E4ED] text-[#232333] font-medium transition-colors"
                >
                  Alex Johnson
                </button>
              </div>
            </div>

            {/* Tab isolation toggle */}
            <div className="flex items-start gap-2.5 pt-2 border-t border-[#E4E4ED]">
              <input
                type="checkbox"
                id="tabOnlyCheck"
                checked={tabOnly}
                onChange={(e) => setTabOnly(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-[#CFCFDC] text-[#0B5CFF] focus:ring-[#0B5CFF] cursor-pointer"
              />
              <label htmlFor="tabOnlyCheck" className="text-xs text-[#6E6E85] cursor-pointer">
                <span className="font-semibold text-[#232333] block">Apply to this tab only</span>
                Recommended for testing: allows keeping Account 1 in one tab and Account 2 in another tab.
              </label>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="rounded-xl border-[#E4E4ED] text-[#232333]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveName}
              disabled={saving || !formName.trim()}
              className="rounded-xl bg-[#0B5CFF] hover:bg-[#0A4FD9] text-white font-medium"
            >
              {saving ? "Saving..." : "Save Identity"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
