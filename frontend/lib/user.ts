export const USER_CHANGED_EVENT = "zoom_user_changed";

const USER_NAME_KEY = "zoom_user_display_name";
const USER_EMAIL_KEY = "zoom_user_display_email";

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
