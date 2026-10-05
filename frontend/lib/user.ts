export const USER_CHANGED_EVENT = "zoom_user_changed";

const USER_NAME_KEY = "zoom_user_display_name";
const USER_EMAIL_KEY = "zoom_user_display_email";
const AUTH_TOKEN_KEY = "zoom_auth_token";

export interface StoredUser {
  name: string;
  email: string;
}

export function getStoredUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  const name =
    sessionStorage.getItem(USER_NAME_KEY) ||
    localStorage.getItem(USER_NAME_KEY);
  const email =
    sessionStorage.getItem(USER_EMAIL_KEY) ||
    localStorage.getItem(USER_EMAIL_KEY) ||
    "";

  if (!name) return null;
  return { name, email };
}

export function setStoredUser(name: string, email = "", tabOnly = false): void {
  if (typeof window === "undefined") return;
  const trimmedName = name.trim();
  const trimmedEmail = email.trim();

  // Always store in sessionStorage so this specific tab keeps its identity
  sessionStorage.setItem(USER_NAME_KEY, trimmedName);
  sessionStorage.setItem(USER_EMAIL_KEY, trimmedEmail);

  if (!tabOnly) {
    localStorage.setItem(USER_NAME_KEY, trimmedName);
    localStorage.setItem(USER_EMAIL_KEY, trimmedEmail);
  }

  // Notify other components in this tab
  window.dispatchEvent(
    new CustomEvent(USER_CHANGED_EVENT, {
      detail: { name: trimmedName, email: trimmedEmail },
    })
  );
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    sessionStorage.getItem(AUTH_TOKEN_KEY) ||
    localStorage.getItem(AUTH_TOKEN_KEY)
  );
}

export function setAuthToken(token: string | null, tabOnly = false): void {
  if (typeof window === "undefined") return;
  if (!token) {
    sessionStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    return;
  }
  sessionStorage.setItem(AUTH_TOKEN_KEY, token);
  if (!tabOnly) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  }
}

export function isAuthenticated(): boolean {
  return Boolean(getAuthToken());
}

export function logout(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(USER_NAME_KEY);
  sessionStorage.removeItem(USER_EMAIL_KEY);
  localStorage.removeItem(USER_NAME_KEY);
  localStorage.removeItem(USER_EMAIL_KEY);

  window.dispatchEvent(
    new CustomEvent(USER_CHANGED_EVENT, {
      detail: { name: "", email: "" },
    })
  );
}
