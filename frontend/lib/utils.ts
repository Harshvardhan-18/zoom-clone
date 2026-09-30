import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a 10-digit meeting code as "403 448 7814" */
export function formatMeetingId(code: string): string {
  const digits = code.replace(/\D/g, "");
  if (digits.length === 10) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`;
  }
  if (digits.length > 6) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  if (digits.length > 3) {
    return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  }
  return digits || code;
}

/** Alias for formatMeetingId for backward compatibility */
export const formatMeetingCode = formatMeetingId;

/** Extract clean 10-digit code from URL, dashes, spaces, etc. */
export function normalizeMeetingCode(raw: string): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  // Check if it's a URL ending with code
  const urlMatch = trimmed.match(/\/j\/([0-9a-zA-Z-]+)/i);
  if (urlMatch) {
    return urlMatch[1].replace(/\D/g, "");
  }
  // Otherwise strip all non-digits
  return trimmed.replace(/\D/g, "");
}

/** Return the invite link for a given meeting code */
export function inviteLink(code: string): string {
  const cleanCode = code.replace(/\D/g, "");
  if (typeof window === "undefined") return `/j/${cleanCode}`;
  return `${window.location.origin}/j/${cleanCode}`;
}

/** Parse UTC ISO string safely ensuring timezone is treated as UTC */
export function parseUtcDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const str = iso.trim();
  if (str.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(str)) {
    const d = new Date(str);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(`${str}Z`);
  return isNaN(d.getTime()) ? new Date(str) : d;
}

/** Format a UTC ISO string to local date string e.g. "Wed, Sep 30" */
export function formatDate(iso: string | null | undefined): string {
  const d = parseUtcDate(iso);
  if (!d) return "";
  try {
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "";
  }
}

/** Format a start time and duration to local time range e.g. "4:11 PM - 4:41 PM" */
export function formatTimeRange(
  iso: string | null | undefined,
  durationMinutes = 30
): string {
  const start = parseUtcDate(iso);
  if (!start) return "";
  try {
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
    const startStr = start.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    const endStr = end.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    return `${startStr} - ${endStr}`;
  } catch {
    return "";
  }
}

/** Format elapsed seconds as HH:MM:SS or MM:SS (e.g. 00:12:41) */
export function formatElapsed(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/** Palette for deterministic avatar colors */
const AVATAR_PALETTE = [
  "#3E8577", // Teal (default)
  "#2D6BE4", // Zoom Action Blue
  "#EE7A3B", // Orange
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#6366F1", // Indigo
  "#06B6D4", // Cyan
  "#84CC16", // Lime
];

/** Return deterministic avatar color for a given name */
export function getAvatarColor(name: string, isDefaultUser = false): string {
  if (isDefaultUser || !name) return "#3E8577";
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_PALETTE.length;
  return AVATAR_PALETTE[index];
}

/** Return single initial in uppercase */
export function getInitial(name: string): string {
  if (!name) return "U";
  const trimmed = name.trim();
  return (trimmed.charAt(0) || "U").toUpperCase();
}
