/** Dynamic backend URL resolver. Automatically routes to Render in cloud, localhost in dev. */
export function getApiBase(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL;
  if (envUrl && !envUrl.includes("localhost")) {
    return envUrl.replace(/\/+$/, "");
  }
  // In the browser: if not localhost, automatically use production Render backend
  if (
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1"
  ) {
    return "https://zoom-clone-dq29.onrender.com";
  }
  return (envUrl || "http://localhost:8000").replace(/\/+$/, "");
}

import { getAuthToken } from "./user";

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const base = getApiBase();
  const token = getAuthToken();
  const headers = new Headers(options?.headers || {});
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }
  // 204 No Content has no body
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface User {
  id: number;
  name: string;
  email: string;
  avatar_color: string;
  created_at: string;
}

export interface Meeting {
  id: number;
  meeting_code: string;
  title: string;
  description: string | null;
  host_id: number;
  type: "instant" | "scheduled";
  status: "scheduled" | "live" | "ended";
  start_time: string | null;
  duration_minutes: number;
  is_seed?: boolean;
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
}

export interface Participant {
  id: number;
  meeting_id: number;
  user_id: number | null;
  display_name: string;
  role: "host" | "participant";
  is_muted: boolean;
  is_video_on: boolean;
  status: "joined" | "left" | "removed";
  joined_at: string;
  left_at: string | null;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export const loginApi = (body: { email: string; password: string }) =>
  req<AuthResponse>("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export const registerApi = (body: { name: string; email: string; password: string }) =>
  req<AuthResponse>("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export const getAuthMe = (token: string) =>
  req<User>(`/api/auth/me?token=${encodeURIComponent(token)}`);

export const getMe = () => req<User>("/api/me");

export const updateMe = (body: { name?: string; email?: string }) =>
  req<User>("/api/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export const getUpcoming = () => req<Meeting[]>("/api/meetings/upcoming");

export const getRecent = () => req<Meeting[]>("/api/meetings/recent");

export const getMeeting = (code: string) =>
  req<Meeting>(`/api/meetings/${code}`);

export const createMeeting = (body: {
  title?: string;
  description?: string;
  start_time?: string;
  duration_minutes?: number;
}) =>
  req<Meeting>("/api/meetings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export const deleteMeeting = (code: string, participantId: number) =>
  req<void>(`/api/meetings/${code}`, {
    method: "DELETE",
    headers: { "x-participant-id": String(participantId) },
  });

export const joinMeeting = (
  code: string,
  body: { display_name: string; as_host?: boolean }
) =>
  req<Participant>(`/api/meetings/${code}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export const endMeeting = (code: string, participantId: number) =>
  req<Meeting>(`/api/meetings/${code}/end`, {
    method: "POST",
    headers: { "x-participant-id": String(participantId) },
  });

export const muteAll = (code: string, participantId: number) =>
  req<Participant[]>(`/api/meetings/${code}/mute-all`, {
    method: "POST",
    headers: { "x-participant-id": String(participantId) },
  });

export const listParticipants = (code: string) =>
  req<Participant[]>(`/api/meetings/${code}/participants`);

export const updateParticipant = (
  id: number,
  body: { is_muted?: boolean; is_video_on?: boolean }
) =>
  req<Participant>(`/api/participants/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export const leaveParticipant = (id: number) =>
  req<Participant>(`/api/participants/${id}/leave`, { method: "POST" });

export const removeParticipant = (id: number, hostParticipantId: number) =>
  req<void>(`/api/participants/${id}`, {
    method: "DELETE",
    headers: { "x-participant-id": String(hostParticipantId) },
  });
