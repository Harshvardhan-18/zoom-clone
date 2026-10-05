"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, Mail, User as UserIcon, Sparkles, ArrowRight, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginApi, registerApi } from "@/lib/api";
import { setAuthToken, setStoredUser } from "@/lib/user";
import { formatMeetingId } from "@/lib/utils";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get("redirect") || "/";

  // Login form state
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Guest join state
  const [guestMeetingCode, setGuestMeetingCode] = useState("");
  const [guestName, setGuestName] = useState("");

  // Default credentials fill handler
  function handleFillDemoCredentials() {
    setEmail("alex@example.com");
    setPassword("demo1234");
    toast.success("Default credentials loaded into fields!");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Please fill in both email and password");
      return;
    }

    if (isRegister && !name.trim()) {
      toast.error("Please enter your name");
      return;
    }

    setSubmitting(true);
    try {
      if (isRegister) {
        const res = await registerApi({
          name: name.trim(),
          email: email.trim(),
          password,
        });
        setAuthToken(res.token);
        setStoredUser(res.user.name, res.user.email);
        toast.success(`Account created! Welcome, ${res.user.name}`);
        router.push(redirectPath);
      } else {
        const res = await loginApi({
          email: email.trim(),
          password,
        });
        setAuthToken(res.token);
        setStoredUser(res.user.name, res.user.email);
        toast.success(`Welcome back, ${res.user.name}!`);
        router.push(redirectPath);
      }
    } catch (err: unknown) {
      toast.error((err as Error).message || "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  }

  function handleGuestJoin(e: React.FormEvent) {
    e.preventDefault();
    const cleanCode = guestMeetingCode.replace(/[\s-]/g, "").trim();
    if (!cleanCode) {
      toast.error("Please enter a meeting code");
      return;
    }
    const cleanName = guestName.trim() || "Guest Participant";
    router.push(`/j/${cleanCode}?name=${encodeURIComponent(cleanName)}`);
  }

  return (
    <div className="min-h-screen bg-[#F5F5FA] flex flex-col justify-between">
      {/* Top Navbar */}
      <header className="h-[56px] bg-white border-b border-[#E4E4ED] px-6 flex items-center justify-between shrink-0 select-none">
        <Link href="/" className="flex items-center group">
          <span className="text-[#0B5CFF] font-bold text-[28px] tracking-tight leading-none">
            zoom
          </span>
          <div className="w-[1px] h-6 bg-[#E4E4ED] mx-3" />
          <span className="text-[#232333] text-[20px] font-medium leading-none">
            Workplace
          </span>
        </Link>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-4">
        <div className="w-full max-w-md space-y-6">
          {/* Card: Auth Form */}
          <div className="bg-white rounded-2xl border border-[#E4E4ED] shadow-sm p-6 sm:p-8">
            <div className="text-center mb-6">
              <h1 className="text-2xl font-bold text-[#232333]">
                {isRegister ? "Create your account" : "Sign in to Zoom"}
              </h1>
              <p className="text-sm text-[#6E6E85] mt-1">
                {isRegister
                  ? "Enter your details to create an account"
                  : "Enter your credentials to access meetings and dashboard"}
              </p>
            </div>

            {/* Quick Demo Fill Banner */}
            {!isRegister && (
              <div className="mb-6 p-3 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-blue-900">
                  <Sparkles size={16} className="text-[#0B5CFF] shrink-0" />
                  <span className="leading-snug">
                    Want to test quickly? Auto-fill default credentials.
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleFillDemoCredentials}
                  className="shrink-0 h-8 text-xs font-semibold rounded-lg bg-white border-blue-200 text-[#0B5CFF] hover:bg-blue-100/50 cursor-pointer shadow-none"
                >
                  Fill Default
                </Button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegister && (
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs font-medium text-[#232333]">
                    Full Name
                  </Label>
                  <div className="relative">
                    <UserIcon
                      size={16}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6E6E85]"
                    />
                    <Input
                      id="name"
                      type="text"
                      placeholder="Alex Johnson"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-9 h-11 rounded-xl border-[#CFCFDC]"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium text-[#232333]">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6E6E85]"
                  />
                  <Input
                    id="email"
                    type="email"
                    placeholder="alex@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 h-11 rounded-xl border-[#CFCFDC]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-medium text-[#232333]">
                    Password
                  </Label>
                  {!isRegister && (
                    <span className="text-[11px] text-[#6E6E85]">Default: demo1234</span>
                  )}
                </div>
                <div className="relative">
                  <Lock
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6E6E85]"
                  />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 h-11 rounded-xl border-[#CFCFDC]"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-11 rounded-xl bg-[#0B5CFF] hover:bg-[#0A4FD9] text-white font-semibold text-sm cursor-pointer shadow-xs mt-2"
              >
                {submitting
                  ? "Signing in..."
                  : isRegister
                  ? "Create Account"
                  : "Sign In"}
              </Button>
            </form>

            {/* Toggle Sign in / Register */}
            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={() => setIsRegister(!isRegister)}
                className="text-xs text-[#0B5CFF] hover:underline font-medium cursor-pointer"
              >
                {isRegister
                  ? "Already have an account? Sign In"
                  : "Don't have an account? Create one"}
              </button>
            </div>
          </div>

          {/* Guest Join Box (No login required) */}
          <div className="bg-white rounded-2xl border border-[#E4E4ED] shadow-sm p-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
                <Video size={18} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-[#232333]">
                  Join a meeting as Guest
                </h2>
                <p className="text-xs text-[#6E6E85]">
                  No login required. Just enter Meeting ID & your name.
                </p>
              </div>
            </div>

            <form onSubmit={handleGuestJoin} className="space-y-3 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Input
                  placeholder="Meeting ID (e.g. 538 850 2865)"
                  value={guestMeetingCode}
                  onChange={(e) => setGuestMeetingCode(e.target.value)}
                  className="h-10 text-xs rounded-xl border-[#CFCFDC]"
                />
                <Input
                  placeholder="Your Name (e.g. Sarah Connor)"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="h-10 text-xs rounded-xl border-[#CFCFDC]"
                />
              </div>
              <Button
                type="submit"
                variant="outline"
                className="w-full h-10 rounded-xl border-[#CFCFDC] text-[#232333] hover:bg-[#F5F5FA] text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Join Meeting directly</span>
                <ArrowRight size={14} />
              </Button>
            </form>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-[#6E6E85]">
        Zoom Clone Demo &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#F5F5FA] flex items-center justify-center">
          <div className="h-10 w-10 rounded-full border-3 border-[#0B5CFF] border-t-transparent animate-spin" />
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
