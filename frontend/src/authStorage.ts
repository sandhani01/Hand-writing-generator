import type { UserProfile } from "./types";

const TOKEN_KEY = "handwritten-auth-token";
const USER_KEY = "handwritten-auth-user";

export function readStoredAuthToken(): string | null {
  return window.localStorage.getItem(TOKEN_KEY);
}


export function readStoredAuthUser(): UserProfile | null {
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as UserProfile;
  } catch {
    return null;
  }
}


export function persistAuthSession(token: string, user: UserProfile): void {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}


export function clearStoredAuthSession(): void {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}
